import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class VolumeScrollerExtensionPreferences extends ExtensionPreferences {
   fillPreferencesWindow(window) {
    window._settings = this.getSettings();

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
      value: window._settings.get_int('granularity'),
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
    });
    window._settings.bind(
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
}
