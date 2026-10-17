# Volume Scroller for GNOME Shell

Use the mouse wheel on the GNOME Top Bar to increase or decrease volume.

Available for download on [GNOME Shell Extensions](https://extensions.gnome.org/extension/5904/volume-scroller/).

This was forked from https://github.com/trflynn89/gnome-shell-volume-scroller which is unfortunately now archived.

## Manual Installation

To install from a release package, download the [latest release](https://github.com/francislavoie/gnome-shell-volume-scroller/releases)
and install it with the `gnome-extensions` tool, which also compiles the settings schema:

```bash
gnome-extensions install --force volume_scroller@francislavoie.github.io.*.shell-extension.zip
```

Then log out and log back in to load it (on X11 you can instead press `Alt+F2` and run `r`).

## Contributing

The compiled schema isn't committed or shipped (GNOME Shell 45+ compiles it on install). When
running the extension straight from a checkout, compile it locally after changing the schema:

```bash
glib-compile-schemas volume_scroller@francislavoie.github.io/schemas/
```

For testing on Wayland, see https://gjs.guide/extensions/development/creating.html#testing-the-extension for tips on running a nested GNOME session, which is necessary to run the extension without restarting your main GNOME session (logout/login).
