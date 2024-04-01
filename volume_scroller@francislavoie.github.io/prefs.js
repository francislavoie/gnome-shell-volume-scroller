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

    // Create the preference rows
    const granularityRow = new Adw.ActionRow({ title: 'Granularity' });
    const invertScrollRow = new Adw.ActionRow({ title: 'Invert Scroll' });
    group.add(granularityRow);
    group.add(invertScrollRow);

    // Create the value picker
    const granularityEntry = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({ step_increment: 1, lower: 1, upper: 50 }),
      value: window._settings.get_int('granularity'),
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
    });

    // Create the direction switch
    const invertScrollSwitch = new Gtk.Switch({
      active: window._settings.get_boolean('invert-scroll'),
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
    });

    // Bind the settings to the widgets
    window._settings.bind(
      'granularity',
      granularityEntry,
      'value',
      Gio.SettingsBindFlags.DEFAULT
    );
    
    window._settings.bind(
      'invert-scroll',
      invertScrollSwitch,
      'active',
      Gio.SettingsBindFlags.DEFAULT
    );

    // Add the granularity value picker to the row
    granularityRow.add_suffix(granularityEntry);
    granularityRow.activatable_widget = granularityEntry;

    // Add the direction switch to the row
    invertScrollRow.add_suffix(invertScrollSwitch);
    invertScrollRow.activatable_widget = invertScrollSwitch;

    // Add our page to the window
    window.add(page);
  }
}
