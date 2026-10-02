// The living dragon's lab (plan Ruling R8): a dev-only page, built by vite.lab.config.ts, never shipped.
import { mount } from 'svelte';
import DragonLab from './DragonLab.svelte';

const target = document.getElementById('lab');
if (!target) throw new Error('#lab missing');
mount(DragonLab, { target });
