const { Adw, Gio, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();


function init() {
}

function fillPreferencesWindow(window) {
    // Use the same GSettings schema as in `extension.js`
    const settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.volume-scroller');
    
    // Create a preferences page and group
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup();
    page.add(group);

    // Create a new preferences row
    const row = new Adw.ActionRow({ title: 'Granularity' });
    group.add(row);

    // Create the value picker
    const granularityEntry = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({ step_increment: 1, lower: 1, upper: 50 }),
        value: settings.get_int('granularity'),
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
    });
    settings.bind(
        'granularity',
        granularityEntry,
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );

    // Add the value picker to the row
    row.add_suffix(granularityEntry);
    row.activatable_widget = granularityEntry;

    // Add our page to the window
    window.add(page);
}