# 010. Reading notifications: plan

## Approach

The import queue says when an import is ready or has failed. The bindings turn
that into a notice with fixed, generic wording, and pass it on only while the
setting is on. `desktop/main.ts`, which owns the window, keeps track of whether
the window is in front and shows the notice with the Web Notifications API that
Deno Desktop provides. Clicking it sets the page's address fragment, so the
existing routes do the navigation.

Only the wording function decides what a notification says, and its tests check
that no file name, model or error text gets through.

## Modules

| File                                          | Role                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `desktop/settings.ts`                         | `notifyWhenRead`, on by default                                         |
| `desktop/imports/notice.ts`                   | `readingNotice(job)`: title, body, tag and link, or none                |
| `desktop/imports/queue.ts`                    | `onFinished`, called when an import becomes ready or fails              |
| `desktop/bindings.ts`                         | `notify` dependency, called while the setting is on                     |
| `desktop/main.ts`                             | Window focus, permission, the notification, click to bring the app back |
| `app/src/composables/useNotifications.ts`     | The saved setting                                                       |
| `app/src/components/NotificationSettings.vue` | Settings section with the switch                                        |

## Testing

- `notice_test.ts`: wording for ready and failed imports, nothing for other
  states, and no file name, model or error in any notice.
- `queue_test.ts`: ready and failed imports are announced, cancelled ones
  aren't, and a listener that throws doesn't stop reading.
- `bindings_test.ts`: a notice is passed on with the setting on, not with it
  off.
- `settings_test.ts` and the contract suite: on by default, only true or false.
- The desktop window can't be scripted, so focus, permission and clicking
  through are checked by hand.
