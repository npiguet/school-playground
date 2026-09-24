import { mount } from 'svelte';
import './styles/fonts.css';
import './app.css';
import './styles/kit.css';
import { startRouter } from './lib/router.svelte';
import App from './App.svelte';

startRouter();

export default mount(App, { target: document.getElementById('app')! });
