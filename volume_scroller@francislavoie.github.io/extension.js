import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as Volume from "resource:///org/gnome/shell/ui/status/volume.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const VolumeScrollerIcons = [
  "audio-volume-muted-symbolic",
  "audio-volume-low-symbolic",
  "audio-volume-medium-symbolic",
  "audio-volume-high-symbolic",
];

export default class VolumeScrollerExtension extends Extension {
  enable() {
    this.settings = this.getSettings();
    const setGranularity = () => {
        this.volume_granularity = this.settings.get_int("granularity") / 100.0;
    };

    this.controller = Volume.getMixerControl();
    this.panel = Main.panel;

    this.enabled = false;
    this.sink = null;

    this.volume_max = this.controller.get_vol_max_norm();
    setGranularity();

    this.scroll_binding = null;
    this.sink_binding = null;

    this.settings.connect("changed::granularity", setGranularity);

    this.enabled = true;
    this.sink = this.controller.get_default_sink();

    this.scroll_binding = this.panel.connect(
      "scroll-event",
      this._handle_scroll
    );
    this.sink_binding = this.controller.connect(
      "default-sink-changed",
      this._handle_sink_change
    );
  }

  disable() {
    this.settings = null;
    this.enabled = false;
    this.sink = null;

    this.panel.disconnect(this.scroll_binding);
    this.scroll_binding = null;
    this.panel = null;

    this.controller.disconnect(this.sink_binding);
    this.sink_binding = null;
    this.controller = null;
  }

  _handle_scroll(_actor, event) {
    let volume = this.sink.volume;

    switch (event.get_scroll_direction()) {
      case Clutter.ScrollDirection.UP:
        volume += this._get_step();
        break;

      case Clutter.ScrollDirection.DOWN:
        volume -= this._get_step();
        break;

      default:
        return Clutter.EVENT_PROPAGATE;
    }

    volume = Math.clamp(volume, 0, this.volume_max);

    this.sink.volume = volume;
    this.sink.push_volume();

    this._show_volume(volume);

    return Clutter.EVENT_STOP;
  }

  _handle_sink_change(controller, id) {
    this.sink = controller.lookup_stream_id(id);
  }

  _show_volume(volume) {
    const percentage = volume / this.volume_max;
    const iconIndex = volume === 0
      ? 0
      : Math.clamp(Math.floor(3 * percentage + 1), 1, 3);

    const monitor = -1; // Display volume window on all monitors.
    const icon = Gio.Icon.new_for_string(VolumeScrollerIcons[iconIndex]);
    const label = this.sink.get_port().human_port;

    Main.osdWindowManager.show(monitor, icon, label, percentage);
  }

  _get_step() {
    return this.volume_max * this.volume_granularity;
  }
}
