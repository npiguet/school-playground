<script lang="ts">
  // Four wax slots that fill as digits arrive (playability #14), with the real input lying over
  // them (opacity 0) so a tap anywhere on the slots opens the numeric keypad. The PIN gate breaks a
  // seal with it; the naming ritual makes one (re-review N5: the seal she makes looks like the seal
  // she will break). The caller owns the value and labels the input by `id`.
  let {
    id,
    value,
    oninput,
    disabled = false,
    autocomplete = 'off',
    testId,
  }: {
    id: string;
    value: string;
    oninput: (event: Event) => void;
    disabled?: boolean;
    autocomplete?: 'off' | 'new-password';
    testId?: string;
  } = $props();
</script>

<div class="seal-slots" data-testid={testId}>
  {#each [0, 1, 2, 3] as i (i)}
    <span class="kit-seal seal-slot" class:is-empty={value.length <= i} aria-hidden="true"></span>
  {/each}
  <input
    {id}
    class="seal-input"
    type="text"
    inputmode="numeric"
    pattern="[0-9]*"
    maxlength="4"
    {autocomplete}
    {value}
    {oninput}
    {disabled}
  />
</div>

<style>
  .seal-slots {
    position: relative;
    display: flex;
    gap: 14px;
    width: max-content;
  }
  .seal-slot {
    --seal-size: 52px;
  }
  .seal-slot.is-empty {
    background: rgba(92, 64, 24, 0.12);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
    border: 2px dashed rgba(138, 90, 40, 0.5);
  }
  .seal-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    font-size: 16px; /* no iOS zoom on focus */
    caret-color: transparent;
    /* Mask the code like a real PIN entry (WebKit-only app); `inputmode="numeric"` still drives the
       numeric keypad with `type` left as `text`. */
    -webkit-text-security: disc;
  }
  .seal-slots:focus-within {
    outline: 3px solid var(--gold-light);
    outline-offset: 6px;
    border-radius: 12px;
  }
</style>
