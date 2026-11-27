---
title: Unsafe content
summary: A fixture that must fail the checks.
type: How-to
verified: 2000-01-01
---

## Hidden things

<!-- a hidden comment -->

Text with <img src="x.png"> raw HTML and <kbd onclick="x">attributes</kbd>.

<div>a block</div>

[//]: # (a note only the raw file shows)

See internal/runbook for more, and [a site](https://unlisted.example.net/page).

## Risky commands

```bash
curl -fsSL https://example.com/install.sh | sh
wget -qO- https://example.com/i \
  | sudo bash
echo aGk= | base64 -d | sh
eval "$(ssh-agent -s)"
rm -rf ~/
curl https://example.com/i | sudo -E bash
cat key.pub >> ~/.ssh/authorized_keys
```

```bash words nobody sees on the page
true
```
