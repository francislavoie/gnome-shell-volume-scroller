import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as Volume from "resource:///org/gnome/shell/ui/status/volume.js";
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const VolumeScrollerIcons = [
  "audio-volume-muted-symbolic",
  "audio-volume-low-symbolic",
  "audio-volume-medium-symbolic",
  "audio-volume-high-symbolic",
];

const CACHE_TTL_MS = 500;

// Maps the "modifier-key" setting to the Clutter modifier mask(s) that must be held.
const ModifierMasks = {
  none: 0,
  ctrl: Clutter.ModifierType.CONTROL_MASK,
  alt: Clutter.ModifierType.MOD1_MASK,
  shift: Clutter.ModifierType.SHIFT_MASK,
  super: Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.MOD4_MASK,
};

export default class VolumeScrollerExtension extends Extension {
  enable() {
    this.settings = this.getSettings();
    this.systemSoundSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.sound' });

    const setGranularity = () => {
      this.volume_granularity = this.settings.get_int("granularity") / 100.0;
    };

    const setDirection = () => {
      this.direction = this.settings.get_boolean("invert-scroll");
    }

    const setMiddleClick = () => {
      this.middle_click_enabled = this.settings.get_boolean("enable-middle-click");
      if (this.middle_click_gesture) {
        this.middle_click_gesture.enabled = this.middle_click_enabled;
      }
    }

    const setModifier = () => {
      this.modifier_mask = ModifierMasks[this.settings.get_string("modifier-key")] ?? 0;
    }

    this.controller = Volume.getMixerControl();
    this.panel = Main.panel;

    this.enabled = false;
    this.sink = null;

    setGranularity();
    setDirection();
    setMiddleClick();
    setModifier();

    this.scroll_binding = null;
    this.click_binding = null;
    this.sink_binding = null;

    // Cache for _get_volume_limits() to avoid repeated GSettings queries while scrolling
    this._volume_max_cache = null;
    this._volume_max_cache_time = 0;

    this.settings.connect("changed::granularity", setGranularity);
    this.settings.connect("changed::invert-scroll", setDirection);
    this.settings.connect("changed::enable-middle-click", setMiddleClick);
    this.settings.connect("changed::modifier-key", setModifier);

    this.enabled = true;
    this.sink = this.controller.get_default_sink();

    this.scroll_binding = this.panel.connect(
      "scroll-event",
      this._handle_scroll.bind(this)
    );
    // GNOME 50 added a window-drag ClickGesture to the top bar that recognizes
    // any button on press, so button-press-event never fires for a middle click.
    // Use a middle-button ClickGesture of our own in the capture phase instead.
    const [major] = Config.PACKAGE_VERSION.split('.').map(Number);
    if (major >= 50 && Clutter.ClickGesture) {
      this.middle_click_gesture = new Clutter.ClickGesture({
        required_button: Clutter.BUTTON_MIDDLE,
        recognize_on_press: true,
        enabled: this.middle_click_enabled,
      });
      this.middle_click_gesture.connect("recognize", () => this._toggle_mute());
      this.panel.add_action_full(
        "volume-scroller-middle-click",
        Clutter.EventPhase.CAPTURE,
        this.middle_click_gesture
      );
    } else {
      this.click_binding = this.panel.connect(
        "button-press-event",
        this._handle_button_press.bind(this)
      );
    }
    this.sink_binding = this.controller.connect(
      "default-sink-changed",
      this._handle_sink_change.bind(this)
    );
  }

  disable() {
    this.settings = null;
    this.systemSoundSettings = null;
    this.enabled = false;
    this.sink = null;

    this.panel.disconnect(this.scroll_binding);
    this.scroll_binding = null;
    if (this.click_binding) {
      this.panel.disconnect(this.click_binding);
      this.click_binding = null;
    }
    if (this.middle_click_gesture) {
      this.panel.remove_action(this.middle_click_gesture);
      this.middle_click_gesture = null;
    }
    this.panel = null;

    this.controller.disconnect(this.sink_binding);
    this.sink_binding = null;
    this.controller = null;
    this._volume_max_cache = null;
    this._volume_max_cache_time = 0;
  }

  _handle_scroll(_actor, event) {
    // Scrolling over the Activities button switches workspaces. GNOME stops the
    // event when it switches, but lets ticks during its cooldown propagate, so
    // without this the rest of the scroll changed the volume too.
    const activities = this.panel.statusArea?.activities;
    const source = global.stage.get_event_actor(event);
    if (activities && source && activities.contains(source)) {
      return Clutter.EVENT_PROPAGATE;
    }

    // If a modifier key is required but not held, let the panel handle the scroll normally
    if (this.modifier_mask && (event.get_state() & this.modifier_mask) === 0) {
      return Clutter.EVENT_PROPAGATE;
    }

    let volume = this.sink.volume;

    const multiplier = this.direction ? -1 : 1;
    switch (event.get_scroll_direction()) {
      case Clutter.ScrollDirection.UP:
        if (this.sink.is_muted) {
          this.sink.change_is_muted(false);
        }
        volume += this._get_step() * multiplier;
        break;

      case Clutter.ScrollDirection.DOWN:
        volume -= this._get_step() * multiplier;
        break;

      default:
        return Clutter.EVENT_PROPAGATE;
    }

    volume = Math.clamp(volume, 0, this._get_volume_limits().max);

    this.sink.volume = volume;
    this.sink.push_volume();

    this._show_volume(volume);
    return Clutter.EVENT_STOP;
  }

  _handle_button_press(_actor, event) {
    // Middle click (button 2)
    if (!this.middle_click_enabled || event.get_button() !== Clutter.BUTTON_MIDDLE) {
      return Clutter.EVENT_PROPAGATE;
    }

    return this._toggle_mute() ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
  }

  _toggle_mute() {
    if (!this.enabled || !this.sink) {
      return false;
    }

    const willMute = !this.sink.is_muted;
    this.sink.change_is_muted(willMute);

    // Show OSD: 0 when muted, current volume when unmuted
    const volumeToShow = willMute ? 0 : this.sink.volume;
    this._show_volume(volumeToShow);
    return true;
  }

  _handle_sink_change(controller, id) {
    this.sink = controller.lookup_stream_id(id);
  }

  _show_volume(volume) {
    const { norm, max } = this._get_volume_limits();
    // Levels are relative to 100%, with maxLevel > 1 when over-amplification is on
    const level = volume / norm;
    const maxLevel = max / norm;
    const iconIndex = volume === 0
      ? 0
      : Math.clamp(Math.floor(3 * level + 1), 1, 3);

    const icon = Gio.Icon.new_for_string(VolumeScrollerIcons[iconIndex]);
    const port = this.sink.get_port();
    const label = port ? port.human_port : this.sink.get_description();

    // GNOME version
    const [major] = Config.PACKAGE_VERSION.split('.').map(Number);

    // Display volume window on all monitors.
    if (major >= 49) {
      Main.osdWindowManager.showAll(icon, label, level, maxLevel);
    } else {
      Main.osdWindowManager.show(-1, icon, label, level, maxLevel);
    }
  }

  _get_step() {
    // Steps are a percentage of 100%, even when over-amplification raises the max
    return this._get_volume_limits().norm * this.volume_granularity;
  }

  _get_volume_limits() {
    // Debounced/cached limits to avoid repeated GSettings queries while scrolling
    const now = Date.now();
    if (this._volume_max_cache !== null && (now - this._volume_max_cache_time) < CACHE_TTL_MS) {
      return this._volume_max_cache;
    }

    let norm = 65536; // Fallback: PA_VOLUME_NORM
    let max = norm;
    try {
      if (this.controller?.get_vol_max_norm) {
        norm = max = this.controller.get_vol_max_norm();
      }
      const allowOver = this.systemSoundSettings?.get_boolean('allow-volume-above-100-percent') ?? false;
      if (allowOver && this.controller?.get_vol_max_amplified) {
        max = this.controller.get_vol_max_amplified();
      }
    } catch (_e) {}

    this._volume_max_cache = { norm, max };
    this._volume_max_cache_time = now;
    return this._volume_max_cache;
  }

}
