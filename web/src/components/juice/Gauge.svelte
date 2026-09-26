<script lang="ts">
  // Rounded progress bar (XP toward the next rank, weekly goal, mastery windows, ...).
  // Olive fill always - orange is Éris's sabotage colour and never used for the
  // player's own progress (spec §2 "orange rather than red"). Spans only, so it can sit inside a
  // button (the dossier's lieutenant sheets).
  let { value, max, label }: { value: number; max: number; label: string } = $props();

  let pct = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);
</script>

<span class="gauge">
  <span class="gauge-label">
    <span>{label}</span>
    <span class="gauge-value muted">{value} / {max}</span>
  </span>
  <span
    class="gauge-track"
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin="0"
    aria-valuemax={max}
    aria-label={label}
  >
    <span class="gauge-fill" style="width:{pct}%"></span>
  </span>
</span>

<style>
  .gauge {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .gauge-label {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
  }

  .gauge-track {
    display: block;
    height: 14px;
    border-radius: 999px;
    background: var(--marble-dark);
    overflow: hidden;
  }

  .gauge-fill {
    display: block;
    height: 100%;
    background: var(--olive);
    border-radius: 999px;
    transition: width 0.6s ease;
  }
</style>
