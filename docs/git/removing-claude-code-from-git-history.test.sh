# Scenario: five commits carrying Claude trailers; the guide rewrites the last three.
# docs/GUIDE.md first appears BEFORE that range and CLAUDE.md inside it.

SUBSTITUTE=(
  "HEAD~N..HEAD=HEAD~3..HEAD"
  "Your Name=New Author"
  "you@example.com=new@example.com"
)

TRAILERS=("Co-Authored-By: Claude <noreply@anthropic.com>" "Claude-Session: https://claude.ai/code/session_test")

setup() {
  export GIT_AUTHOR_NAME="Old Author" GIT_AUTHOR_EMAIL="old@example.com"
  export GIT_COMMITTER_NAME="Old Author" GIT_COMMITTER_EMAIL="old@example.com"
  commit README.md     "one: readme"        "${TRAILERS[@]}"
  commit docs/GUIDE.md "two: agent guide"   "${TRAILERS[@]}"
  commit CLAUDE.md     "three: agent notes" "${TRAILERS[@]}"
  commit docs/GUIDE.md "four: edit guide"   "${TRAILERS[@]}"
  commit app.txt       "five: app"          "${TRAILERS[@]}"
  git push -q origin main
  remember base "$(git rev-parse HEAD~3)"
}

verify() {
  local base
  base="$(recall base)"

  # git config --global wrote to the fake home
  assert_eq "$(git config --file "$HOME/.gitconfig" core.editor)" "code --wait" "core.editor"

  # the rewrite
  assert_identity HEAD~3..HEAD "New Author" "new@example.com"
  assert_no_trailer HEAD~3..HEAD Co-Authored-By Claude-Session
  assert_files_absent HEAD~3..HEAD CLAUDE.md docs/GUIDE.md
  assert_eq "$(git log --format=%s HEAD~3..HEAD | tr '\n' ,)" "five: app,four: edit guide,three: agent notes," "subjects kept"

  # older commits are untouched, so a file added before the range is still there
  assert_eq "$(git rev-parse HEAD~3)" "$base" "commits before the range"
  assert_identity "$base" "Old Author" "old@example.com"
  git cat-file -e "$base:docs/GUIDE.md" || fail "expected docs/GUIDE.md to remain in older history"

  # the removed files are gone from the working folder too
  [ ! -e CLAUDE.md ] && [ ! -e docs/GUIDE.md ] || fail "expected CLAUDE.md and docs/GUIDE.md to be deleted from the folder"

  # git keeps a backup, and the guide's inline command removes it
  [ -n "$(git for-each-ref refs/original/)" ] || fail "expected a backup under refs/original/"
  git for-each-ref --format='%(refname)' refs/original/ | xargs -n 1 git update-ref -d
  assert_eq "$(git for-each-ref refs/original/)" "" "backup refs after cleanup"

  # the force push replaced the remote history
  assert_eq "$(git --git-dir="$ORIGIN" log --format=%H main)" "$(git log --format=%H main)" "remote history"

  # the interactive rebase technique, driven without an editor
  GIT_SEQUENCE_EDITOR="sed -i.bak -e '1s/^pick/edit/'" git rebase -q -i HEAD~2
  echo "edited" > extra.txt
  git add extra.txt
  git commit -q --amend --no-edit
  GIT_EDITOR=true git rebase --continue
  git cat-file -e HEAD~1:extra.txt || fail "the edited commit did not keep the change"
  assert_eq "$(git branch --show-current)" "main" "branch after rebase"
}
