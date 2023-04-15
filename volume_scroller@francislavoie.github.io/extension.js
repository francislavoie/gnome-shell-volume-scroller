const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Volume = imports.ui.status.volume;
const ExtensionUtils = imports.misc.extensionUtils;

let volume_scroller = null;

const VolumeScrollerIcons =
[
    'audio-volume-muted-symbolic',
    'audio-volume-low-symbolic',
    'audio-volume-medium-symbolic',
    'audio-volume-high-symbolic'
];

class VolumeScroller
{
    constructor()
    {
        this.settings = ExtensionUtils.getSettings(
            'org.gnome.shell.extensions.volume-scroller');
        const setGranularity = () => {
            this.volume_granularity = this.settings.get_int('granularity') / 100.0;
        };

        this.controller = Volume.getMixerControl();
        this.panel = Main.panel;

        this.enabled = false;
        this.sink = null;

        this.volume_max = this.controller.get_vol_max_norm();
        setGranularity();

        this.scroll_binding = null;
        this.sink_binding = null;

        this.settings.connect('changed::granularity', setGranularity);
    }

    enable()
    {
        if (this.enabled)
        {
            this.disable();
        }

        this.enabled = true;
        this.sink = this.controller.get_default_sink();

        this.scroll_binding = this.panel.connect(
            'scroll-event',
            (actor, event) => this._handle_scroll(actor, event));

        this.sink_binding = this.controller.connect(
            'default-sink-changed',
            (controller, id) => this._handle_sink_change(controller, id));
    }

    disable()
    {
        if (this.enabled)
        {
            this.enabled = false;
            this.sink = null;

            this.panel.disconnect(this.scroll_binding);
            this.scroll_binding = null;

            this.controller.disconnect(this.sink_binding);
            this.sink_binding = null;
        }
    }

    _handle_scroll(actor, event)
    {
        let volume = this.sink.volume;

        switch (event.get_scroll_direction())
        {
            case Clutter.ScrollDirection.UP:
                volume += this._get_step();
                break;

            case Clutter.ScrollDirection.DOWN:
                volume -= this._get_step();
                break;

            default:
                return Clutter.EVENT_PROPAGATE;
        }

        volume = Math.min(volume, this.volume_max);
        volume = Math.max(volume, 0);

        this.sink.volume = volume;
        this.sink.push_volume();

        this._show_volume(volume);

        return Clutter.EVENT_STOP;
    }

    _handle_sink_change(controller, id)
    {
        this.sink = controller.lookup_stream_id(id);
    }

    _show_volume(volume)
    {
        const percentage = volume / this.volume_max;
        let n;

        if (volume === 0)
        {
            n = 0;
        }
        else
        {
            n = parseInt(3 * percentage + 1);
            n = Math.max(1, n);
            n = Math.min(3, n);
        }

        const monitor = -1; // Display volume window on all monitors.
        const icon = Gio.Icon.new_for_string(VolumeScrollerIcons[n]);
        const label = this.sink.get_port().human_port;

        Main.osdWindowManager.show(monitor, icon, label, percentage);
    }

    _get_step()
    {
        return this.volume_max * this.volume_granularity;
    }
};

function enable()
{
    volume_scroller = new VolumeScroller();
    volume_scroller.enable();
}

function disable()
{
    if (volume_scroller !== null)
    {
        volume_scroller.disable();
        volume_scroller = null;
    }
}
