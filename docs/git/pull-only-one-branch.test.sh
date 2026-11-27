# Scenario: main and feature have moved on the remote, and release is new there.

SUBSTITUTE=("https://github.com/OWNER/REPO.git=\$ORIGIN copy")

setup() {
  commit a.txt "one: start"
  git push -q origin main
  git branch -q --set-upstream-to=origin/main
  git branch feature
  git push -q origin feature
  remember old_main "$(git rev-parse HEAD)"
  remember old_feature "$(git rev-parse feature)"

  commit b.txt "two: more on main"
  git push -q origin main
  git switch -q feature && commit f.txt "feature work" && git push -q origin feature
  git switch -q -c release && commit r.txt "release work" && git push -q origin release

  # put this clone back to how it was before those pushes
  git switch -q main
  git reset -q --hard "$(recall old_main)"
  git branch -q -D feature release
  git update-ref refs/remotes/origin/main "$(recall old_main)"
  git update-ref refs/remotes/origin/feature "$(recall old_feature)"
  git update-ref -d refs/remotes/origin/release
  git --git-dir="$ORIGIN" symbolic-ref HEAD refs/heads/main
}

verify() {
  local listing
  listing="$(output_of 2)"
  grep -q "origin/feature $(git rev-parse --short "$(recall old_feature)")" <<< "$(tr -s ' ' <<< "$listing")" \
    || fail "feature should not have been updated by the one-off pull: $listing"
  if grep -q origin/release <<< "$listing"; then fail "the one-off pull fetched release"; fi

  assert_eq "$(git log -1 --format=%s main)" "two: more on main" "main was pulled"
  assert_eq "$(git config --get-all remote.origin.fetch)" "+refs/heads/*:refs/remotes/origin/*" "undone"
  assert_eq "$(git rev-parse origin/feature)" "$(git --git-dir="$ORIGIN" rev-parse feature)" "feature after undo"
  assert_eq "$(git -C copy config --get-all remote.origin.fetch)" "+refs/heads/main:refs/remotes/origin/main" "single-branch clone"

  # the permanent setting on its own: only main is fetched
  git remote set-branches origin main
  git update-ref -d refs/remotes/origin/release
  git fetch -q origin
  if git rev-parse -q --verify origin/release > /dev/null; then fail "release was fetched although only main is tracked"; fi
}
