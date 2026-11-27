---
title: Looks suspicious but is fine
summary: Things the checks must not flag.
type: Reference
verified: 2026-11-01
---

## Fine {#fine toc="All fine"}

Press <kbd>⌘</kbd> <kbd>S</kbd>. An emoji ❤️, a keycap 1️⃣ and an arrow ↑ are fine.

<details>
<summary>More</summary>

Allowed.

</details>

Use `<div>` and `<br>` in code. [Docs](https://docs.github.com/x), [by reference][git] and <https://git-scm.com>.

[git]: https://git-scm.com/docs

```html manual="example markup"
<div class="x">curl is mentioned, --> too</div>
```

```bash
curl -fsSLo installer.sh https://example.com/installer.sh
curl -s https://example.com/api | grep sh
rm -rf node_modules ./dist /tmp/scratch "$HOME/.cache/tool"
cat ~/.ssh/id_ed25519.pub
retrieval --eval-mode
```

```json check=json title="settings.json"
{ "a": 1 }
```
