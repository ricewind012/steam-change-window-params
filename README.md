# Change Window Parameters

Modify how Steam displays windows. Use system titlebar, transparent windows, no size limits, etc.

![Preview](./assets/preview.png)

## Settings

After changing settings, you must click the "Restart Steam UI" button if you want the changes to apply immediately.

Verified settings are not compatible with advanced mode, so you will have to perform the aforementioned (verified settings take priority) and use advanced mode only.

## Themes

The plugin adds each parameter _in its options_ as an attribute to the `<html>` element:

| Option               | Attribute                                                  |
| -------------------- | ---------------------------------------------------------- |
| Use system titlebar  | browsertype="DirectHWND"                                   |
| Transparent windows  | createflags="Resizable Composited TransparentParentWindow" |
| No window size limit | minheight="0" minwidth="0"                                 |

## Localization

You can translate this plugin to your own language by translating [this file][locales]. See [here](https://partner.steamgames.com/doc/store/localization/languages#supported_languages) in "API language code" on how to name the translated file.

## Advanced mode

Anything not in verified settings may have **unintended side effects** if you don't know what you're doing! If anything bad happens, you can always execute the `steam://millennium/settings/plugins/disable/steam-change-window-params` URL to disable the plugin. Do NOT open issues about anything in advanced mode.

Behavior for params without a description is unknown. Feel free to document (and show it in the PR) its behavior [here][locales].

[locales]: ./locales/english.json
