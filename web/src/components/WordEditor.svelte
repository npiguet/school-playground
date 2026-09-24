<script lang="ts">
  // Inline editor for one token of the player's text (spec §3.4 "tap a word → inline edit").
  // Enter, the OK button and blur commit; Escape cancels; an empty value means "delete".
  import { onMount, untrack } from 'svelte';

  let {
    value,
    onCommit,
    onCancel,
  }: { value: string; onCommit: (v: string) => void; onCancel: () => void } = $props();

  let draft = $state(untrack(() => value)); // seeded once; the editor owns its draft
  let input: HTMLInputElement | undefined = $state();
  let settled = false; // commit/cancel exactly once (blur also fires after Enter/Escape/OK)

  const size = $derived(Math.max(3, draft.length + 2));

  function commit() {
    if (settled) return;
    settled = true;
    onCommit(draft);
  }

  function cancel() {
    if (settled) return;
    settled = true;
    onCancel();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }

  onMount(() => {
    input?.focus();
    input?.select();
    requestAnimationFrame(() => input?.scrollIntoView({ block: 'center', inline: 'nearest' }));
  });
</script>

<span class="editor">
  <span class="row">
    <input
      bind:this={input}
      bind:value={draft}
      type="text"
      lang="fr"
      autocorrect="off"
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
      enterkeyhint="done"
      {size}
      data-testid="word-editor"
      aria-label="Nouveau mot"
      onkeydown={onKeydown}
      onblur={commit}
    />
    <button type="button" class="btn btn-primary ok" onmousedown={(e) => e.preventDefault()} onclick={commit}>
      OK
    </button>
  </span>
  <span class="hint muted">Vide = supprimer le mot</span>
</span>

<style>
  .editor {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    vertical-align: middle;
    gap: 2px;
    margin: 0 4px;
    line-height: 1.3;
  }
  .row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  input {
    min-height: 44px;
    padding: 6px 10px;
    font-size: 22px;
    font-family: var(--font-reading);
    border-color: var(--aegean);
    width: auto;
  }
  .ok {
    min-height: 44px;
    padding: 6px 14px;
    font-size: 16px;
  }
  .hint {
    font-size: 13px;
    white-space: nowrap;
  }
</style>
