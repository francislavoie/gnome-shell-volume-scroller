# Volume Scroller for GNOME Shell

Use the mouse wheel on the GNOME Top Bar to increase or decrease volume.

Available for download on [GNOME Shell Extensions](https://extensions.gnome.org/extension/5904/volume-scroller/).

This was forked from https://github.com/trflynn89/gnome-shell-volume-scroller which is unfortunately now archived.

## Manual Installation

To install from a release package, download the [latest release](https://github.com/francislavoie/gnome-shell-volume-scroller/releases)
and extract the downloaded archive to the GNOME Shell Extensions path:

```bash
unzip volume_scroller@francislavoie.github.io.*.shell-extension.zip -d volume_scroller@francislavoie.github.io
mv volume_scroller@francislavoie.github.io ~/.local/share/gnome-shell/extensions
```

Then restart GNOME Shell. You may either log out and log back in, or enter `Alt+F2` to open the run
dialog, then type `r` to restart the GNOME Shell.

## Contributing

If you need to update the schema file, run this to update the compiled schema:

```bash
glib-compile-schemas volume_scroller@francislavoie.github.io/schemas/
```

For testing on Wayland, see https://gjs.guide/extensions/development/creating.html#testing-the-extension for tips on running a nested GNOME session, which is necessary to run the extension without restarting your main GNOME session (logout/login).
