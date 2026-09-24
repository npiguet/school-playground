<script lang="ts">
  // Rounded progress bar (XP toward the next rank, weekly goal, mastery windows, ...).
  // Olive fill always - orange is Éris's sabotage colour and never used for the
  // player's own progress (spec §2 "orange rather than red").
  let { value, max, label }: { value: number; max: number; label: string } = $props();

  let pct = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);
</script>

<div class="gauge">
  <div class="gauge-label">
    <span>{label}</span>
    <span class="gauge-value muted">{value} / {max}</span>
  </div>
  <div
    class="gauge-track"
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin="0"
    aria-valuemax={max}
    aria-label={label}
  >
    <div class="gauge-fill" style="width:{pct}%"></div>
  </div>
</div>

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
    height: 14px;
    border-radius: 999px;
    background: var(--marble-dark);
    overflow: hidden;
  }

  .gauge-fill {
    height: 100%;
    background: var(--olive);
    border-radius: 999px;
    transition: width 0.6s ease;
  }
</style>
