// Original extension by ImDarkTom
// Brightness percentage feature added by Otavio - Brazil (github.com/Infra379)
// 2026-06-05

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gvc from 'gi://Gvc';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(`<node>
<interface name="org.gnome.SettingsDaemon.Power.Screen">
  <property name="Brightness" type="i" access="readwrite"/>
</interface>
</node>`);

export default class VolumePercentageExtension extends Extension {
    enable() {
        this._mixer = new Gvc.MixerControl({ name: this.uuid });
        this._mixer.connectObject('default-sink-changed', (mixer) => this._onSinkChanged(mixer), this);
        this._mixer.open();

        this._brightnessProxy = new BrightnessProxy(
            Gio.DBus.session,
            'org.gnome.SettingsDaemon',
            '/org/gnome/SettingsDaemon/Power'
        );
        this._brightnessProxy.connectObject(
            'g-properties-changed', () => this._updateBrightness(),
            this
        );

        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._label = new St.Label({
                text: '--%',
                y_align: Clutter.ActorAlign.CENTER,
                style: 'min-width: 3em; text-align: right;',
            });

            this._brightnessLabel = new St.Label({
                text: '--%',
                y_align: Clutter.ActorAlign.CENTER,
                style: 'min-width: 3em; text-align: right;',
            });

            const quickSettingsMenu = Main.panel.statusArea.quickSettings.menu;

            const sliderRow = quickSettingsMenu._grid.get_children()[1].get_first_child();
            // [mute button] [slider] [<our inserted label>] [settings button]
            sliderRow.insert_child_at_index(this._label, 2);

            // Brightness row has 2 children (icon + slider), unlike volume rows (3 children)
            const brightnessRow = this._findBrightnessRow(quickSettingsMenu);
            if (brightnessRow)
                brightnessRow.insert_child_at_index(this._brightnessLabel, 2);

            this._update();
            this._updateBrightness();

            this._idleId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _findBrightnessRow(quickSettingsMenu) {
        const gridChildren = quickSettingsMenu._grid.get_children();
        for (let i = 2; i < gridChildren.length; i++) {
            const row = gridChildren[i]?.get_first_child();
            if (row?.get_n_children() === 2)
                return row;
        }
        return null;
    }

    _onSinkChanged(mixer) {
        this._sink?.disconnectObject(this);

        this._sink = mixer.get_default_sink();
        if (!this._sink) return;

        this._sink.connectObject(
            'notify::volume', () => this._update(),
            'notify::is-muted', () => this._update(),
            this
        );

        this._update();
    }

    _update() {
        if (!this._label || !this._sink) return;

        const volumePercent = Math.round(this._sink.get_volume() / this._mixer.get_vol_max_norm() * 100);
        this._label.text = this._sink.get_is_muted() ? '0%' : `${volumePercent}%`;
    }

    _updateBrightness() {
        if (!this._brightnessLabel) return;
        const b = this._brightnessProxy?.Brightness ?? -1;
        this._brightnessLabel.text = b >= 0 ? `${b}%` : '--%';
    }

    disable() {
        if (this._idleId) {
            GLib.source_remove(this._idleId);
            this._idleId = 0;
        }

        this._sink?.disconnectObject(this);
        this._sink = null;

        this._mixer?.disconnectObject(this);
        this._mixer?.close();
        this._mixer = null;

        this._brightnessProxy?.disconnectObject(this);
        this._brightnessProxy = null;

        this._label?.destroy();
        this._label = null;

        this._brightnessLabel?.destroy();
        this._brightnessLabel = null;
    }
}
