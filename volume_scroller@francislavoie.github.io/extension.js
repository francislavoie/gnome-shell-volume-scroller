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
    }

    this.controller = Volume.getMixerControl();
    this.panel = Main.panel;

    this.enabled = false;
    this.sink = null;

    setGranularity();
    setDirection();
    setMiddleClick();

    this.scroll_binding = null;
    this.click_binding = null;
    this.sink_binding = null;

    // Cache for _get_volume_max() to avoid repeated GSettings queries while scrolling
    this._volume_max_cache = null;
    this._volume_max_cache_time = 0;

    this.settings.connect("changed::granularity", setGranularity);
    this.settings.connect("changed::invert-scroll", setDirection);
    this.settings.connect("changed::enable-middle-click", setMiddleClick);

    this.enabled = true;
    this.sink = this.controller.get_default_sink();

    this.scroll_binding = this.panel.connect(
      "scroll-event",
      this._handle_scroll.bind(this)
    );
    this.click_binding = this.panel.connect(
      "button-press-event",
      this._handle_button_press.bind(this)
    );
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
    this.panel.disconnect(this.click_binding);
    this.click_binding = null;
    this.panel = null;

    this.controller.disconnect(this.sink_binding);
    this.sink_binding = null;
    this.controller = null;
    this._volume_max_cache = null;
    this._volume_max_cache_time = 0;
  }

  _handle_scroll(_actor, event) {
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

    volume = Math.clamp(volume, 0, this._get_volume_max());

    this.sink.volume = volume;
    this.sink.push_volume();

    this._show_volume(volume);
    return Clutter.EVENT_STOP;
  }

  _handle_button_press(_actor, event) {
    // Middle click (button 2)
    if (!this.enabled || !this.sink || !this.middle_click_enabled || event.get_button() !== 2) {
      return Clutter.EVENT_PROPAGATE;
    }

    const willMute = !this.sink.is_muted;
    this.sink.change_is_muted(willMute);

    // Show OSD: 0 when muted, current volume when unmuted
    const volumeToShow = willMute ? 0 : this.sink.volume;
    this._show_volume(volumeToShow);
    return Clutter.EVENT_STOP;
  }

  _handle_sink_change(controller, id) {
    this.sink = controller.lookup_stream_id(id);
  }

  _show_volume(volume) {
    const percentage = volume / this._get_volume_max();
    const iconIndex = volume === 0
      ? 0
      : Math.clamp(Math.floor(3 * percentage + 1), 1, 3);

    const icon = Gio.Icon.new_for_string(VolumeScrollerIcons[iconIndex]);
    const label = this.sink.get_port().human_port;
    
    // GNOME version
    const [major] = Config.PACKAGE_VERSION.split('.').map(Number);

    // Display volume window on all monitors.
    if (major >= 49) {
      Main.osdWindowManager.showAll(icon, label, percentage);
    } else {
      Main.osdWindowManager.show(-1, icon, label, percentage);
    }
  }

  _get_step() {
    return this._get_volume_max() * this.volume_granularity;
  }

  _get_volume_max() {
    // Debounced/cached max volume fetch to avoid lag while scrolling
    const now = Date.now();
    if (this._volume_max_cache !== null && (now - this._volume_max_cache_time) < CACHE_TTL_MS) {
      return this._volume_max_cache;
    }

    let max = 65536; // Fallback: PA_VOLUME_NORM
    try {
      const allowOver = this.systemSoundSettings?.get_boolean('allow-volume-above-100-percent') ?? false;
      if (allowOver && this.controller?.get_vol_max_amplified) {
        max = this.controller.get_vol_max_amplified();
      }
      if (this.controller?.get_vol_max_norm) {
        max = this.controller.get_vol_max_norm();
      }
      if (this.controller?.get_vol_max) {
        max = this.controller.get_vol_max();
      }
    } catch (_e) {}

    this._volume_max_cache = max;
    this._volume_max_cache_time = now;
    return max;
  }
}
