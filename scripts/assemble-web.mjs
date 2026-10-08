import { existsSync, readFileSync } from 'node:fs';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGAL_UPDATED, PRIVACY_LEAD, PRIVACY_SECTIONS, RENEWAL_NOTICE, TERMS_LEAD, TERMS_SECTIONS, legalCopy, legalRuns } from '../src/lib/legal.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const webDir = path.join(root, 'web-dist');

const css = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html { background: #fff; scroll-behavior: smooth; }
  body {
    margin: 0;
    background: #fff;
    color: #0a0a0a;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    height: 3.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 1.25rem;
    background: #fff;
    border-bottom: 1px solid #eee;
  }
  .bar a {
    color: #0a0a0a;
    font-size: 0.95rem;
    font-weight: 650;
    letter-spacing: -0.02em;
    text-decoration: none;
  }
  .bar a:hover { color: #525252; }
  .brand {
    position: absolute;
    left: 1.25rem;
    font-weight: 700;
  }
  .bar-links {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 1.5rem;
    align-items: center;
    pointer-events: none;
  }
  .bar-cluster {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    white-space: nowrap;
    pointer-events: auto;
  }
  .bar-cluster-left { justify-self: end; }
  .bar-cluster-right { justify-self: start; }
  .bar-end {
    position: absolute;
    right: 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }
  a.bar-signin,
  button.bar-signin,
  a.bar-open {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 2.15rem;
    padding: 0 0.9rem;
    border-radius: 999px;
    font-size: 0.9rem;
    font-weight: 600;
  }
  a.bar-signin,
  button.bar-signin {
    border: 1px solid #d4d4d4;
    background: #fff;
    color: #0a0a0a;
  }
  button.bar-signin {
    appearance: none;
    cursor: pointer;
    font-family: inherit;
  }
  a.bar-signin:hover,
  button.bar-signin:hover { background: #f5f5f5; color: #0a0a0a; }
  a.bar-signin[hidden],
  button.bar-signin[hidden] { display: none !important; }
  a.bar-open {
    background: #0a0a0a;
    color: #fff;
  }
  a.bar-open:hover { background: #262626; color: #fff; }
  .hero {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4.5rem 1.5rem 2.5rem;
  }
  .hero h1 {
    margin: 0;
    font-size: clamp(3.4rem, 11vw, 7.25rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 0.95;
  }
  .tag {
    margin: 1.35rem 0 0;
    max-width: 22rem;
    font-size: clamp(1.2rem, 2.4vw, 1.55rem);
    line-height: 1.35;
    letter-spacing: -0.03em;
    color: #404040;
  }
  a.jump {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    margin-top: 2.75rem;
    color: #0a0a0a;
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  a.jump svg { width: 1.75rem; height: 1.75rem; }
  a.jump:hover { color: #525252; }
  .block {
    scroll-margin-top: 3.25rem;
    width: min(40rem, 100%);
    margin: 0 auto;
    padding: 4.5rem 1.5rem 1rem;
  }
  .block h2 {
    margin: 0;
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    letter-spacing: -0.04em;
    line-height: 1.1;
  }
  .block > p, .method p, .doc p {
    margin: 1rem 0 0;
    font-size: 1.0625rem;
    line-height: 1.55;
    color: #404040;
  }
  .doc ul {
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
    color: #404040;
    font-size: 1.0625rem;
    line-height: 1.55;
  }
  .doc li { margin-top: 0.35rem; }
  .modes-wrap {
    --phone-short: 16.5rem;
    width: 100%;
    margin: 0;
    padding: 0 0 3.5rem;
  }
  .modes-wrap h2 {
    text-align: center;
    font-size: clamp(2.6rem, 6.5vw, 4rem);
  }
  .paper-black {
    background: #0a0a0a;
    color: #fff;
    height: calc(100dvh - 3.25rem);
    min-height: calc(100dvh - 3.25rem);
    scroll-margin-top: 3.25rem;
    padding: 1.15rem 1.5rem 4.5rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .paper-slip {
    width: min(72rem, 100%);
    margin: 0 auto;
  }
  .modes-wrap .paper-slip h2 {
    margin: 0;
    text-align: center;
    font-size: clamp(1.15rem, 2.5vw, 1.85rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.25;
    color: #fff;
  }
  .paper-sheet {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
    margin: 1.35rem auto 0;
    display: flex;
  }
  .paper-nos {
    flex: 1;
    min-height: 0;
    height: 100%;
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr) max-content;
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch;
    gap: 1rem 1.25rem;
  }
  .paper-no { grid-column: 1; position: relative; z-index: 2; text-align: left; align-self: start; }
  .paper-no p {
    margin: 0;
    font-size: clamp(2.8rem, 6.6vw, 6.25rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 0.95;
    text-align: left;
    white-space: nowrap;
    color: #fff;
  }
  .paper-no p + p { margin-top: 0.18em; }
  .paper-back {
    grid-column: 3;
    position: relative;
    z-index: 2;
    margin: 4.75rem 0.35rem 0 1.25rem;
    align-self: start;
    text-align: right;
    font-size: clamp(1rem, 1.6vw, 1.2rem);
    line-height: 1.35;
    letter-spacing: -0.02em;
    color: #fff;
  }
  .paper-mock {
    position: absolute;
    z-index: 1;
    left: 50%;
    top: 0;
    width: min(34rem, calc(50vw - 26rem));
    aspect-ratio: 9 / 16;
    height: auto;
    min-height: 0;
    overflow: hidden;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .paper-mock video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    display: block;
    object-fit: fill;
    transform: none;
    opacity: 0;
    pointer-events: none;
  }
  .paper-close {
    position: relative;
    z-index: 2;
    margin-top: auto;
    padding-top: 1.5rem;
    text-align: center;
  }
  .paper-procrastination {
    margin: 0;
    text-align: center;
    white-space: nowrap;
    font-size: clamp(1.25rem, 2.6vw, 1.7rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.2;
    color: #fff;
  }
  .paper-skip {
    margin: 0.85rem 0 0;
    text-align: center;
    white-space: nowrap;
    font-size: clamp(1rem, 2vw, 1.25rem);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: #fff;
  }
  a.paper-down {
    display: inline-flex;
    margin-top: 1.75rem;
    color: #fff;
    text-decoration: none;
  }
  a.paper-down svg { width: 2.25rem; height: 2.25rem; }
  a.paper-down:hover { color: #d4d4d4; }
  .paper-rest {
    width: min(78rem, 100%);
    margin: 0 auto;
    padding: 4.5rem 1.5rem 0;
    scroll-margin-top: 3.25rem;
  }
  .paper-modes-head { text-align: center; }
  .paper-sub {
    margin: 0.7rem 0 0;
    text-align: center;
    white-space: nowrap;
    font-size: clamp(1rem, 2.2vw, 1.35rem);
    line-height: 1.35;
    letter-spacing: -0.03em;
    color: #525252;
  }
  .mode-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.75rem;
    margin-top: 2.85rem;
    align-items: stretch;
  }
  .mode-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    min-height: 46rem;
    padding: 2.2rem 1.15rem 2.4rem;
    border: 1px solid #e6e6e6;
    border-radius: 1.9rem;
    background: linear-gradient(180deg, #fff 0%, #f5f5f5 100%);
    box-shadow: 0 30px 70px rgba(10, 10, 10, 0.1);
  }
  .mode-card h3 {
    margin: 0;
    font-size: clamp(1.5rem, 2.1vw, 1.9rem);
    letter-spacing: -0.045em;
    line-height: 1.05;
  }
  .mode-card p {
    margin: 0.85rem 0 0;
    max-width: 16.5rem;
    font-size: 1.05rem;
    line-height: 1.45;
    color: #525252;
  }
  .mode-card > p { min-height: 4.9rem; }
  .mode-stage {
    flex: none;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
    height: calc(var(--phone-short) * 19.2 / 9);
    margin-top: 1.85rem;
  }
  .true-cram { overflow: hidden; }
  .true-stage {
    position: relative;
    width: 100%;
    flex: none;
    height: calc(var(--phone-short) * 19.2 / 9);
    margin-top: 1.85rem;
  }
  .true-stage { --turn: 0.82; }
  .true-stage .turn {
    position: absolute;
    width: calc(var(--phone-short) * 19.2 / 9 * var(--turn));
    height: calc(var(--phone-short) * var(--turn));
    pointer-events: none;
  }
  .true-stage .turn .phone.portrait {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--phone-short);
    max-width: none;
    transform: translate(-50%, -50%) rotate(-90deg) scale(var(--turn));
  }
  .turn .screen { container-type: size; }
  .turn .ph-land {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 100cqh;
    height: 100cqw;
    display: flex;
    flex-direction: column;
    transform: translate(-50%, -50%) rotate(90deg);
  }
  .turn .ph-land .ph-head {
    gap: 10px;
    padding: 8px 16px 8px 18px;
    border-bottom-color: #e5e5e5;
  }
  .turn .ph-land .ph-home {
    width: 36px;
    height: 36px;
    border-radius: 12px;
  }
  .turn .ph-land .ph-home svg { width: 16px; height: 16px; }
  .turn .ph-land .ph-kicker { font-size: 11px; }
  .turn .ph-land .ph-name {
    margin-top: 1px;
    font-size: 14px;
    letter-spacing: -0.02em;
  }
  .turn .ph-land .ph-stat { font-size: 14px; font-weight: 600; }
  .turn .ph-land .cockpit { padding: 0 14px 8px 28px; }
  .turn .ph-land .ph-list {
    width: 168px;
    flex: none;
    background: #fff;
    border-right-color: #e5e5e5;
    padding: 8px 8px 6px;
  }
  .turn .ph-land .ph-cat {
    margin: 0 6px 4px;
    font-size: 10px;
    letter-spacing: 0.04em;
  }
  .turn .ph-land .ph-item {
    align-items: flex-start;
    gap: 6px;
    margin-top: 2px;
    padding: 4px 6px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.25;
  }
  .turn .ph-land .ph-n {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    font-size: 11px;
  }
  .turn .ph-land .ph-main { padding: 10px 8px 2px 16px; }
  .turn .ph-land .ph-main .ph-label { font-size: 12px; letter-spacing: 0.04em; }
  .turn .ph-land .ph-main .ph-term {
    margin-top: 2px;
    font-size: 26px;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .turn .ph-land .ph-def {
    margin-top: 4px;
    color: #737373;
    font-size: 16px;
    font-weight: 500;
    line-height: 1.3;
  }
  .turn .ph-land .ph-actions { gap: 10px; }
  .turn .ph-land .ph-actions .ph-btn {
    height: 44px;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 600;
  }
  .turn .ph-land .ph-btn.ghost { box-shadow: inset 0 0 0 1px #e5e5e5; }
  .true-stage .bleed-right { top: 0; left: 0.75rem; }
  .true-stage .bleed-left { bottom: 0; right: 0.75rem; }
  .true-cram .partner-copy {
    position: absolute;
    left: 0.85rem;
    right: 0.85rem;
    top: 50%;
    z-index: 2;
    margin: 0;
    max-width: none;
    color: #171717;
    font-size: clamp(1.05rem, 1.25vw, 1.28rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.2;
    transform: translateY(-50%);
  }
  .phone {
    position: relative;
    background: #141414;
    box-shadow:
      inset 0 0 0 1px #2a2a2a,
      0 26px 50px rgba(10, 10, 10, 0.24);
  }
  .phone.portrait {
    width: min(var(--phone-short), 100%);
    aspect-ratio: 9 / 19.2;
    height: auto;
    border-radius: 2.4rem;
    padding: 0.55rem;
  }
  .phone.landscape {
    width: min(100%, 19.25rem);
    aspect-ratio: 19.2 / 9;
    border-radius: 1.45rem;
    padding: 0.34rem;
    container-type: inline-size;
  }
  .screen {
    position: relative;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #fff;
    color: #171717;
  }
  .phone.portrait .screen { border-radius: 1.95rem; font-size: 16px; }
  .phone.landscape .screen { border-radius: 1.15rem; font-size: 2.7cqi; }
  .island, .grip {
    position: absolute;
    z-index: 3;
    background: #141414;
    border-radius: 999px;
  }
  .phone.portrait .island {
    top: 0.55rem;
    left: 50%;
    width: 5.2rem;
    height: 1.05rem;
    transform: translateX(-50%);
  }
  .phone.landscape .island {
    top: 50%;
    left: 0.28rem;
    width: 0.42rem;
    height: 2.15rem;
    transform: translateY(-50%);
  }
  .phone.portrait .grip {
    left: 50%;
    bottom: 0.42rem;
    width: 34%;
    height: 0.22rem;
    transform: translateX(-50%);
  }
  .phone.landscape .grip {
    top: 50%;
    right: 0.3rem;
    width: 0.2rem;
    height: 26%;
    transform: translateY(-50%);
  }
  .ph-head {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 1.9em 0.8em 0.55em;
    border-bottom: 1px solid #ececec;
  }
  .phone.landscape .ph-head { padding: 0.5em 1.15em 0.4em 1.25em; }
  .ph-home {
    width: 1.7em;
    height: 1.7em;
    border-radius: 0.45em;
    background: #171717;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .ph-home svg { width: 0.85em; height: 0.85em; }
  .ph-titles { min-width: 0; flex: 1; text-align: left; }
  .ph-kicker {
    display: block;
    color: #737373;
    font-size: 0.68em;
    line-height: 1.1;
  }
  .ph-name {
    display: block;
    margin-top: 0.12em;
    font-size: 0.78em;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .ph-stat {
    font-size: 0.75em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .ph-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0.7em 0.75em 1.2em;
  }
  .ph-row {
    display: flex;
    justify-content: space-between;
    gap: 0.5em;
    color: #737373;
    font-size: 0.68em;
  }
  .ph-card {
    margin-top: 0.65em;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: 1px solid #ececec;
    border-radius: 1.15em;
    padding: 0.85em 0.7em;
    box-shadow: 0 8px 18px rgba(10, 10, 10, 0.05);
  }
  .ph-label {
    color: #737373;
    font-size: 0.64em;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .ph-term {
    margin: 0.35em 0 0;
    font-size: 1.45em;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.05;
  }
  .ph-hint {
    margin: 0.65em 0 0;
    max-width: 11em;
    color: #737373;
    font-size: 0.75em;
    line-height: 1.35;
  }
  .ph-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 2.15em;
    margin-top: 0.65em;
    border-radius: 0.75em;
    background: #171717;
    color: #fff;
    font-size: 0.82em;
    font-weight: 650;
  }
  .ph-btn.ghost {
    background: #fff;
    color: #171717;
    box-shadow: inset 0 0 0 1px #e5e5e5;
  }
  .ph-write { text-align: left; padding-top: 0.2em; }
  .ph-write .ph-term { font-size: 1.28em; }
  .ph-write .ph-hint { margin: 0.4em 0 0; max-width: none; text-align: left; }
  .ph-field {
    margin-top: 0.55em;
    flex: 1;
    border: 1px solid #e5e5e5;
    border-radius: 0.85em;
    padding: 0.55em 0.6em;
    color: #171717;
    font-size: 0.75em;
    line-height: 1.35;
    text-align: left;
  }
  .cockpit {
    flex: 1;
    min-height: 0;
    display: flex;
    padding-left: 1.05em;
  }
  .ph-list {
    width: 42%;
    overflow: hidden;
    border-right: 1px solid #ececec;
    background: #fafafa;
    padding: 0.35em 0.3em 0.4em;
    text-align: left;
  }
  .ph-cat {
    margin: 0 0.15em 0.2em;
    color: #737373;
    font-size: 0.58em;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .ph-item {
    display: flex;
    align-items: center;
    gap: 0.28em;
    margin-top: 0.18em;
    padding: 0.16em 0.2em;
    border-radius: 0.35em;
    font-size: 0.68em;
    font-weight: 600;
    line-height: 1.15;
    white-space: nowrap;
  }
  .ph-item span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ph-item.on { background: #171717; color: #fff; }
  .ph-n {
    width: 0.95em;
    height: 0.95em;
    border-radius: 0.22em;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #eee;
    color: #737373;
    font-size: 0.55em;
    font-weight: 700;
    flex: none;
  }
  .ph-item.done .ph-n { background: #d1fae5; color: #065f46; }
  .ph-item.on .ph-n { background: rgba(255, 255, 255, 0.18); color: #fff; }
  .ph-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 0.35em 1em 0.4em 0.5em;
    text-align: left;
  }
  .ph-main .ph-term { margin-top: 0.15em; font-size: 1.15em; }
  .ph-def {
    margin: 0.2em 0 0;
    color: #525252;
    font-size: 0.78em;
    font-weight: 550;
    line-height: 1.3;
  }
  .ph-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.3em;
    margin-top: auto;
  }
  .ph-actions .ph-btn {
    height: 1.65em;
    margin-top: 0;
    border-radius: 0.5em;
    font-size: 0.68em;
  }
  .phone.landscape .ph-head { padding: 0.28em 0.7em 0.22em 1.15em; }
  .phone.landscape .ph-home { width: 1.25em; height: 1.25em; }
  .phone.landscape .ph-home svg { width: 0.7em; height: 0.7em; }
  .phone.landscape .cockpit { padding-left: 0.7em; }
  .phone.landscape .ph-list { padding: 0.2em 0.2em 0.25em; }
  .phone.landscape .ph-cat { margin-bottom: 0.08em; }
  .phone.landscape .ph-item { margin-top: 0.06em; padding: 0.04em 0.12em; font-size: 0.6em; }
  .phone.landscape .ph-n { width: 0.85em; height: 0.85em; }
  .phone.landscape .ph-main { padding: 0.15em 0.85em 0.2em 0.4em; }
  .phone.landscape .ph-main .ph-term { font-size: 0.92em; }
  .phone.landscape .ph-def { font-size: 0.66em; line-height: 1.2; }
  .phone.landscape .ph-actions { gap: 0.2em; }
  .phone.landscape .ph-actions .ph-btn { height: 1.25em; font-size: 0.58em; }
  .close {
    margin-top: 1.75rem;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: #0a0a0a;
  }
  .doc { padding-bottom: 3rem; }
  .doc h3 { margin: 2.25rem 0 0; font-size: 1.35rem; letter-spacing: -0.03em; }
  .doc h4 { margin: 1.5rem 0 0; font-size: 1rem; letter-spacing: -0.02em; }
  .doc h5 { margin: 1.15rem 0 0; font-size: 0.95rem; letter-spacing: -0.01em; }
  .legal-page { padding-top: 6rem; }
  .legal-table-wrap { margin-top: 1rem; overflow-x: auto; }
  .legal-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; color: #404040; }
  .legal-table th, .legal-table td {
    text-align: left;
    padding: 0.5rem 0.75rem 0.5rem 0;
    border-bottom: 1px solid #e5e5e5;
    vertical-align: top;
  }
  .legal-table th { font-size: 0.8rem; color: #0a0a0a; }
  .legal-table th:not(:first-child), .legal-table td:not(:first-child) { text-align: right; padding-left: 0.75rem; }
  .site-footer {
    min-height: 100dvh;
    margin-top: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: #0a0a0a;
    color: #fafafa;
    padding: 4.5rem 1.5rem 2.75rem;
  }
  .footer-hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem 0.5rem 2.5rem;
  }
  .footer-hero h2 {
    margin: 0;
    max-width: 14ch;
    font-size: clamp(2.7rem, 6.4vw, 4.4rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1.02;
    color: #fafafa;
  }
  .footer-hero p {
    margin: 1.35rem 0 0;
    max-width: 22rem;
    font-size: clamp(1.15rem, 2.2vw, 1.45rem);
    line-height: 1.4;
    letter-spacing: -0.03em;
    color: #d4d4d4;
  }
  .footer-hero a {
    color: #fff;
    font-weight: 650;
    text-decoration: none;
  }
  .footer-hero a:hover { text-decoration: underline; }
  .footer-base {
    width: min(72rem, 100%);
    margin: 0 auto;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2.5rem;
  }
  .footer-brand { text-align: left; }
  .footer-brand .name {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: #fafafa;
  }
  .footer-brand .line {
    margin: 0.45rem 0 0;
    max-width: 16rem;
    font-size: 0.95rem;
    font-weight: 400;
    line-height: 1.4;
    color: #d4d4d4;
  }
  .footer-brand .copy {
    margin: 0.7rem 0 0;
    font-size: 0.82rem;
    font-weight: 400;
    color: #a3a3a3;
  }
  .footer-cols {
    width: auto;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(4, max-content);
    gap: 1.75rem 2.75rem;
  }
  .footer-col h3 {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #fafafa;
  }
  .footer-col a,
  .footer-col span {
    display: block;
    margin-top: 0.55rem;
    color: #a3a3a3;
    font-size: 0.95rem;
    line-height: 1.3;
    text-decoration: none;
  }
  .footer-col a:hover { color: #fff; }
  .updated { margin-top: 0.75rem; font-size: 0.85rem; color: #737373; }
  .price {
    margin: 1.25rem 0 0;
    font-size: clamp(2rem, 5vw, 2.75rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    color: #0a0a0a;
    line-height: 1.1;
  }
  [hidden] { display: none !important; }
  .plans-wrap { width: min(72rem, 100%); }
  .plan-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
    margin-top: 1.5rem;
    align-items: start;
  }
  .plan-card {
    display: flex;
    flex-direction: column;
    border: 1px solid #e5e5e5;
    border-radius: 1.25rem;
    padding: 1.25rem 1.2rem 1.35rem;
    background: #fff;
  }
  .plan-card h3 {
    margin: 0;
    font-size: 1.2rem;
    letter-spacing: -0.03em;
    line-height: 1.2;
  }
  .plan-current {
    margin: 1.15rem 0 0;
    min-height: 2.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.65rem 1.1rem;
    border-radius: 999px;
    background: #0a0a0a;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 650;
  }
  .plan-current[hidden],
  button.plan-btn[hidden] { display: none !important; }
  .plan-card .price { margin-top: 0.55rem; font-size: clamp(1.8rem, 4vw, 2.35rem); }
  .plan-card .price span {
    margin-left: 0.15rem;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0;
    color: #737373;
  }
  .plan-card ul {
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
  }
  .plan-card li {
    position: relative;
    margin: 0.55rem 0 0;
    padding-left: 1.05rem;
    font-size: 0.95rem;
    line-height: 1.4;
    color: #262626;
  }
  .plan-card li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.45rem;
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 99px;
    background: #0a0a0a;
  }
  .how { margin-top: 1.15rem; }
  .how h4 { margin: 0; font-size: 0.95rem; letter-spacing: -0.02em; }
  .how ol { margin: 0.4rem 0 0; padding-left: 1.15rem; }
  .plan-card .how li { padding-left: 0.2rem; color: #404040; }
  .plan-card .how li::before { content: none; }
  button.plan-btn, a.plan-btn, a.thanks-open {
    appearance: none;
    border: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 1.15rem;
    min-height: 2.75rem;
    padding: 0.65rem 1.1rem;
    border-radius: 999px;
    background: #0a0a0a;
    color: #fff;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 650;
    text-decoration: none;
  }
  button.plan-btn:hover, a.plan-btn:hover, a.thanks-open:hover { background: #262626; color: #fff; }
  button.plan-btn:disabled { opacity: 0.6; cursor: wait; }
  button.plan-btn.secondary,
  a.plan-btn.secondary {
    background: #fff;
    color: #0a0a0a;
    border: 1px solid #d4d4d4;
  }
  button.plan-btn.secondary:hover,
  a.plan-btn.secondary:hover { background: #f5f5f5; color: #0a0a0a; }
  button.plan-btn.danger {
    background: #fff;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }
  button.plan-btn.danger:hover { background: #fef2f2; color: #991b1b; }
  .plan-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .plan-actions button.plan-btn { margin-top: 0.75rem; }
  .plan-code {
    margin: 0.75rem 0 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.92rem;
    line-height: 1.45;
    letter-spacing: 0.01em;
    word-break: break-all;
  }
  .note { margin: 0.85rem 0 0; font-size: 0.95rem; color: #404040; }
  .stack { display: flex; flex-direction: column; gap: 0.65rem; width: 100%; margin-top: 1.15rem; }
  .stack .plan-btn { margin-top: 0; }
  dialog.sign-in {
    margin: auto;
    border: 0;
    border-radius: 1.75rem;
    padding: 1.85rem 1.6rem 1.45rem;
    width: min(24rem, calc(100vw - 2.5rem));
    background: #fff;
    color: #0a0a0a;
    text-align: center;
    box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.22);
    opacity: 0;
    transform: translateY(14px) scale(0.96);
    transition:
      opacity 0.28s ease,
      transform 0.36s cubic-bezier(0.16, 1, 0.3, 1),
      overlay 0.28s ease allow-discrete,
      display 0.28s ease allow-discrete;
  }
  dialog.sign-in[open] { opacity: 1; transform: none; }
  @starting-style {
    dialog.sign-in[open] { opacity: 0; transform: translateY(14px) scale(0.96); }
  }
  dialog.sign-in.closing { opacity: 0; transform: translateY(8px) scale(0.98); }
  dialog.sign-in::backdrop {
    background: rgba(10, 10, 10, 0);
    transition:
      background 0.28s ease,
      overlay 0.28s ease allow-discrete,
      display 0.28s ease allow-discrete;
  }
  dialog.sign-in[open]::backdrop { background: rgba(10, 10, 10, 0.46); }
  @starting-style {
    dialog.sign-in[open]::backdrop { background: rgba(10, 10, 10, 0); }
  }
  dialog.sign-in.closing::backdrop { background: rgba(10, 10, 10, 0); }
  dialog.sign-in .mark {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 650;
    letter-spacing: 0.02em;
    color: #737373;
  }
  dialog.sign-in h3 {
    margin: 0.4rem 0 0;
    font-size: 1.85rem;
    letter-spacing: -0.045em;
    line-height: 1.05;
  }
  dialog.sign-in p { margin: 0.75rem 0 0; color: #404040; line-height: 1.45; font-size: 1rem; }
  dialog.sign-in .plan-btn { width: 100%; margin-top: 1.35rem; }
  dialog.sign-in .text-btn {
    display: block;
    width: 100%;
    margin-top: 0.95rem;
    color: #525252;
    text-align: center;
  }
  dialog.account {
    margin: auto;
    border: 0;
    border-radius: 1.5rem;
    padding: 1.35rem 1.35rem 1.2rem;
    width: min(26rem, calc(100vw - 2rem));
    background: #fff;
    color: #0a0a0a;
    text-align: left;
    box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.22);
  }
  dialog.account::backdrop { background: rgba(10, 10, 10, 0.46); }
  dialog.account h2 {
    margin: 0;
    font-size: 1.45rem;
    letter-spacing: -0.04em;
  }
  .account-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .account-close {
    appearance: none;
    border: 0;
    background: none;
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    color: #525252;
  }
  .account-close:hover { background: #f5f5f5; color: #0a0a0a; }
  .account-rows { margin: 1rem 0 0; }
  .account-rows div { padding: 0.7rem 0; border-top: 1px solid #eee; }
  .account-rows dt {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #737373;
  }
  .account-rows dd {
    margin: 0.2rem 0 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    word-break: break-word;
  }
  .account-partner { margin-top: 0.2rem; padding-top: 0.85rem; border-top: 1px solid #eee; }
  .account-partner[hidden] { display: none !important; }
  .account-partner p { margin: 0; font-size: 0.72rem; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; color: #737373; }
  .account-code {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.35rem;
  }
  .account-code span {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.95rem;
    font-weight: 600;
    word-break: break-all;
  }
  button.account-copy,
  button.account-reset {
    appearance: none;
    cursor: pointer;
    font: inherit;
  }
  button.account-copy {
    border: 0;
    background: none;
    color: #0a0a0a;
    font-size: 0.85rem;
    font-weight: 650;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  button.account-copy[hidden] { display: none !important; }
  button.account-reset {
    width: 100%;
    margin-top: 1rem;
    min-height: 2.75rem;
    border: 1px solid #d4d4d4;
    border-radius: 999px;
    background: #fff;
    font-size: 0.95rem;
    font-weight: 650;
  }
  button.account-reset:hover { background: #f5f5f5; }
  button.account-reset:disabled { opacity: 0.6; cursor: wait; }
  .account-status { margin: 0.75rem 0 0; min-height: 1.2rem; font-size: 0.9rem; color: #404040; }
  .spin {
    display: inline-block;
    width: 0.95rem;
    height: 0.95rem;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 999px;
    animation: bh-spin 0.7s linear infinite;
    flex: none;
  }
  .wait-row, .is-loading {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
  }
  .is-loading::before {
    content: "";
    width: 0.95rem;
    height: 0.95rem;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 999px;
    animation: bh-spin 0.7s linear infinite;
    flex: none;
  }
  button.is-busy { gap: 0.5rem; }
  .bar-auth-wait {
    display: inline-flex;
    width: 2.15rem;
    height: 2.15rem;
    align-items: center;
    justify-content: center;
  }
  .bar-auth-wait[hidden],
  #account-loading[hidden] { display: none !important; }
  @keyframes bh-spin { to { transform: rotate(360deg); } }
  .account-page { width: min(32rem, 100%); padding-bottom: 4rem; }
  .account-page .plan-card { margin-top: 1rem; }
  .account-plan-name {
    margin: 0.45rem 0 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  .account-lines p { margin: 0.55rem 0 0; color: #404040; font-size: 0.98rem; line-height: 1.45; }
  .account-actions { display: flex; flex-direction: column; gap: 0.55rem; margin-top: 1.1rem; }
  .account-actions .plan-btn { width: 100%; margin-top: 0; }
  .account-password label {
    display: block;
    margin-top: 0.85rem;
    font-size: 0.82rem;
    font-weight: 650;
  }
  .account-password input {
    width: 100%;
    height: 2.85rem;
    margin-top: 0.35rem;
    border: 1px solid #e5e5e5;
    border-radius: 0.9rem;
    padding: 0 0.9rem;
    font: inherit;
    font-size: 1rem;
  }
  .account-password .plan-btn { width: 100%; }
  dialog.password { text-align: left; }
  dialog.password h3 { text-align: left; }
  dialog.password .account-status { text-align: left; }
  @media (prefers-reduced-motion: reduce) {
    dialog.sign-in,
    dialog.sign-in::backdrop { transition: none; }
    dialog.sign-in,
    dialog.sign-in.closing { transform: none; }
    .spin, .is-loading::before { animation: none; }
  }
  .stack input,
  .promo input {
    height: 2.85rem;
    border: 1px solid #e5e5e5;
    border-radius: 0.9rem;
    padding: 0 0.9rem;
    font: inherit;
    font-size: 1rem;
  }
  .promo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: min(22rem, 100%);
    margin-top: 1.35rem;
  }
  .promo label {
    font-size: 0.95rem;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  .promo input { flex: 1; min-width: 0; }
  .agree {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    width: min(40rem, 100%);
    margin: 1rem 0 0;
    font-size: 0.95rem;
    line-height: 1.45;
    color: #404040;
  }
  .agree input {
    width: 1.05rem;
    height: 1.05rem;
    margin-top: 0.2rem;
    flex: none;
  }
  .agree a { color: #0a0a0a; font-weight: 650; }
  .renew-note { width: min(40rem, 100%); }
  button.text-btn {
    appearance: none;
    border: 0;
    background: none;
    padding: 0;
    color: #404040;
    font: inherit;
    font-size: 0.92rem;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }
  button.text-btn:hover { color: #0a0a0a; }
  #plans-status { min-height: 1.4em; margin: 1rem 0 0; color: #404040; }
  #redeem-status { margin: 0; font-size: 0.95rem; line-height: 1.4; color: #404040; }
  #redeem-status:empty { display: none; }
  .thanks {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2.5rem 1.5rem;
  }
  .thanks h1 {
    margin: 0;
    max-width: 12ch;
    font-size: clamp(3rem, 9vw, 6rem);
    font-weight: 700;
    letter-spacing: -0.055em;
    line-height: 0.95;
  }
  .thanks p {
    margin: 1.35rem 0 0;
    max-width: none;
    font-size: clamp(1.6rem, 4vw, 2.6rem);
    font-weight: 650;
    letter-spacing: -0.04em;
    line-height: 1.15;
    color: #404040;
  }
  a.thanks-open { margin-top: 2.4rem; position: static; }
  .thanks-partner {
    width: min(28rem, 100%);
    margin-top: 2.2rem;
  }
  .thanks-partner h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 650;
    letter-spacing: -0.03em;
    line-height: 1.25;
    color: #0a0a0a;
  }
  .thanks-code-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    margin-top: 0.7rem;
  }
  .thanks p.thanks-code-value {
    margin: 0;
    max-width: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.98rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.45;
    color: #0a0a0a;
    word-break: break-all;
  }
  button.thanks-copy {
    appearance: none;
    border: 0;
    background: none;
    color: #0a0a0a;
    width: 2.4rem;
    height: 2.4rem;
    padding: 0;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    cursor: pointer;
  }
  button.thanks-copy:hover { background: #f5f5f5; }
  button.thanks-copy svg { width: 1.15rem; height: 1.15rem; }
  .thanks p.thanks-manage {
    margin: 0.7rem 0 0;
    font-size: 0.82rem;
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.45;
    color: #737373;
  }
  .thanks p.thanks-manage a {
    color: #0a0a0a;
    font-weight: 650;
  }
  .contact-page {
    min-height: 100dvh;
    display: grid;
    align-content: safe center;
    width: min(68rem, 100%);
    margin: 0 auto;
    padding: 6.5rem 1.5rem 4.75rem;
  }
  .contact-head { text-align: center; }
  .contact-head h1 {
    margin: 0;
    font-size: clamp(2.4rem, 5vw, 3.5rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1.02;
  }
  .contact-email {
    margin: 0.9rem 0 0;
    font-size: clamp(1.2rem, 2.4vw, 1.55rem);
    font-weight: 650;
    letter-spacing: -0.03em;
    color: #0a0a0a;
  }
  .contact-email a { color: inherit; text-decoration: none; }
  .contact-email a:hover { text-decoration: underline; }
  .contact-head .lede {
    margin: 0.7rem auto 0;
    max-width: 26rem;
    font-size: 1.05rem;
    line-height: 1.45;
    color: #525252;
  }
  .faq { margin-top: 2.75rem; }
  .faq h2 {
    margin: 0 0 1rem;
    text-align: center;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #737373;
  }
  .faq-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.85rem;
    align-items: stretch;
  }
  .faq-item {
    margin: 0;
    padding: 1.2rem 1.25rem 1.3rem;
    border: 1px solid #e5e5e5;
    border-radius: 1.15rem;
    background: #fff;
  }
  .faq-item h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1.3;
  }
  .faq-item p {
    margin: 0.5rem 0 0;
    font-size: 0.98rem;
    line-height: 1.5;
    color: #404040;
  }
  .philosophy-page {
    min-height: 100dvh;
    display: grid;
    align-content: safe center;
    width: min(68rem, 100%);
    margin: 0 auto;
    padding: 6.5rem 1.5rem 4.75rem;
  }
  .philosophy-page h1 {
    margin: 0;
    text-align: center;
    font-size: clamp(2.4rem, 5vw, 3.5rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1.02;
  }
  .philosophy-copy {
    width: min(40rem, 100%);
    margin: 1.75rem auto 0;
  }
  .philosophy-copy p {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.55;
    color: #404040;
  }
  .philosophy-copy p + p { margin-top: 1.15rem; }
  html.motion .reveal {
    opacity: 0;
    transform: translateY(10px);
  }
  html.motion.motion-ready .reveal {
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
    transition-delay: var(--d, 0ms);
  }
  html.motion .reveal.in {
    opacity: 1;
    transform: none;
  }
  html.motion .bar.reveal,
  html.motion .bar.reveal.in {
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    html.motion .reveal {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
  @media (max-width: 1100px) {
    .mode-grid { grid-template-columns: 1fr; gap: 2.4rem; }
    .mode-card {
      width: min(28rem, 100%);
      min-height: 0;
      margin: 0 auto;
      padding-bottom: 2.6rem;
    }
    .mode-card > p { min-height: 0; }
    .phone.portrait { width: min(var(--phone-short), 88%); }
    .mode-stage,
    .true-stage { height: calc(var(--phone-short) * 19.2 / 9); }
    .true-stage .bleed-right { left: 0.75rem; }
    .true-stage .bleed-left { right: 0.75rem; }
  }
  @media (max-width: 900px) {
    .bar {
      height: auto;
      justify-content: space-between;
      flex-wrap: wrap;
      row-gap: 0.35rem;
      padding: 0.55rem 0.85rem 0.7rem;
    }
    .brand, .bar-end { position: static; }
    .bar-links {
      position: static;
      left: auto;
      right: auto;
      top: auto;
      height: auto;
      display: flex;
      grid-template-columns: none;
      column-gap: 0;
      order: 3;
      flex: 1 0 100%;
      align-items: center;
      justify-content: center;
      gap: 0.85rem;
      pointer-events: auto;
    }
    .bar-cluster {
      display: contents;
    }
    .block, .paper-rest { scroll-margin-top: 5.6rem; }
    .paper-black {
      height: calc(100dvh - 5.6rem);
      min-height: calc(100dvh - 5.6rem);
      scroll-margin-top: 5.6rem;
    }
  }
  @media (max-width: 800px) {
    .plan-grid { grid-template-columns: 1fr; }
    .faq-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 760px) {
    .block { scroll-margin-top: 5.6rem; }
    .paper-black {
      height: calc(100dvh - 5.6rem);
      min-height: calc(100dvh - 5.6rem);
      scroll-margin-top: 5.6rem;
    }
    .paper-rest { scroll-margin-top: 5.6rem; }
    .modes-wrap .paper-slip h2 { font-size: 1.05rem; }
    .paper-nos {
      grid-template-columns: minmax(0, 1.15fr) auto;
      grid-template-rows: auto minmax(0, 1fr);
      grid-template-areas: "no back" "phone back";
      gap: 0.45rem 0.7rem;
    }
    .paper-no { grid-column: auto; grid-area: no; }
    .paper-mock {
      position: relative;
      left: auto;
      top: auto;
      grid-area: phone;
      width: auto;
      height: 100%;
      aspect-ratio: auto;
      transform: none;
    }
    .paper-mock video {
      inset: auto;
      top: 0;
      left: 50%;
      width: auto;
      height: 100%;
      max-width: 100%;
      transform: translateX(-50%);
    }
    .paper-back { grid-column: auto; grid-area: back; margin: 0.35rem 0 0; align-self: center; }
    .paper-no p { font-size: clamp(1.7rem, 8.6vw, 2.45rem); }
    .paper-procrastination { font-size: 0.95rem; }
    .paper-skip { font-size: 0.85rem; }
    .paper-sub { font-size: 0.95rem; }
    .footer-base { flex-direction: column; align-items: flex-start; }
    .footer-cols { grid-template-columns: 1fr; text-align: left; gap: 1.6rem; }
  }
  @media (max-width: 520px) {
    .bar a { font-size: 0.85rem; }
    a.bar-signin, button.bar-signin, a.bar-open { font-size: 0.82rem; padding: 0 0.75rem; }
  }
  .brain-wrap {
    width: min(68rem, 100%);
    padding-top: 2.2rem;
    padding-bottom: 7.5rem;
  }
  .brain-wrap h2 {
    text-align: center;
    font-size: clamp(2rem, 5vw, 3.15rem);
  }
  .brain-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 17rem;
    gap: 2.4rem;
    align-items: start;
    margin-top: 2rem;
  }
  .brain-copy p {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.6;
    color: #404040;
  }
  .brain-copy p + p { margin-top: 1.15rem; }
  .brain-copy strong { color: #0a0a0a; font-weight: 700; }
  .brain-scans { display: flex; flex-direction: column; gap: 0.7rem; }
  .brain-scans .scan {
    line-height: 0;
  }
  .brain-scans img { display: block; width: 100%; height: auto; }
  .brain-sticky { margin-top: 5.5rem; }
  .brain-pair {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(16rem, 0.9fr);
    gap: 1.15rem 2.25rem;
    align-items: start;
  }
  .brain-card-col { min-width: 0; }
  .brain-sticky-copy h3 {
    margin: 0;
    font-size: clamp(1.35rem, 2.4vw, 1.7rem);
    letter-spacing: -0.04em;
    line-height: 1.15;
  }
  .brain-sticky-copy p {
    margin: 0.7rem 0 0;
    font-size: 1.0625rem;
    line-height: 1.55;
    color: #404040;
  }
  .brain-dash {
    width: 100%;
    margin: 0;
    background: #fafafa;
    border-radius: 1.35rem;
    overflow: hidden;
    box-shadow: 0 24px 50px rgba(10, 10, 10, 0.16);
  }
  #brain-sim {
    background: #fafafa;
    color: #0a0a0a;
    min-height: 18.5rem;
    display: flex;
    flex-direction: column;
  }
  .bs-top {
    display: flex;
    justify-content: space-between;
    padding: 0.7rem 0.95rem 0;
    font-size: 0.72rem;
    color: #737373;
  }
  .bs-body { display: flex; flex-direction: column; flex: 1; padding: 0.35rem 0.95rem 0.85rem; }
  .bs-kicker { margin: 0; font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: #737373; }
  .bs-title { margin: 0.15rem 0 0; font-size: 1.35rem; font-weight: 700; letter-spacing: -0.04em; }
  .bs-term { margin: 0.15rem 0 0; font-size: 1.45rem; font-weight: 700; letter-spacing: -0.04em; line-height: 1.15; }
  .bs-sub, .bs-def, .bs-peek { margin: 0.4rem 0 0; font-size: 0.95rem; line-height: 1.4; color: #525252; }
  .bs-card {
    margin-top: 0.35rem;
    padding: 1rem 0.9rem 1.05rem;
    border: 1px solid #e5e5e5;
    border-radius: 1.1rem;
    background: #fff;
    text-align: center;
  }
  .bs-defbox {
    margin-top: 0.55rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid #e5e5e5;
    border-radius: 0.85rem;
    background: #fff;
  }
  .bs-term-row {
    margin-top: 0.45rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid #e5e5e5;
    border-radius: 0.75rem;
    background: #fff;
    font-size: 0.95rem;
    font-weight: 650;
  }
  .bs-type {
    margin-top: 0.55rem;
    min-height: 3.2rem;
    padding: 0.6rem 0.7rem;
    border: 1px solid #e5e5e5;
    border-radius: 0.85rem;
    background: #fff;
    font-size: 0.98rem;
    line-height: 1.4;
  }
  .bs-caret {
    display: inline-block;
    width: 1.5px;
    height: 0.95em;
    margin-left: 1px;
    background: #0a0a0a;
    vertical-align: -1px;
    animation: brain-caret 0.85s steps(1) infinite;
  }
  @keyframes brain-caret { 50% { opacity: 0; } }
  .bs-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    height: 2.55rem;
    margin-top: 0.7rem;
    border-radius: 0.85rem;
    font-size: 0.95rem;
    font-weight: 650;
  }
  .bs-btn.solid { background: #0a0a0a; color: #fff; }
  .bs-btn.miss { background: #dc2626; color: #fff; }
  .bs-btn.got { background: #059669; color: #fff; }
  .bs-btn.press { transform: scale(0.97); }
  .bs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
  .bs-row .bs-btn { margin-top: 0.7rem; }
  .bs-foot, .bs-skip { margin: 0.65rem 0 0; text-align: center; font-size: 0.78rem; color: #737373; }
  .bs-skip { text-decoration: underline; text-underline-offset: 2px; }
  .bs-finger {
    position: absolute;
    right: 0.45rem;
    top: 50%;
    width: 1.15rem;
    height: 1.15rem;
    margin-top: -0.57rem;
    border-radius: 999px;
    background: #ffd7bd;
    border: 2px solid rgba(0, 0, 0, 0.55);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  }
  @media (max-width: 800px) {
    .brain-split { grid-template-columns: minmax(0, 1fr) minmax(7.5rem, 42%); gap: 0.9rem; }
    .brain-pair { grid-template-columns: 1fr; gap: 1.15rem; }
    .bs-term { font-size: 1.15rem; }
    .bs-title { font-size: 1.15rem; }
    #brain-sim { min-height: 16rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    .bs-caret { animation: none; }
  }
  .cookie-notice {
    position: fixed;
    left: 0.75rem;
    right: 0.75rem;
    bottom: 0.75rem;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    max-width: 52rem;
    margin: 0 auto;
    padding: 0.9rem 1rem;
    background: #fff;
    color: #0a0a0a;
    border: 1px solid #e5e5e5;
    border-radius: 1rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  }
  .cookie-notice[hidden] { display: none !important; }
  .cookie-notice p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.45;
  }
  .cookie-notice a { color: #0a0a0a; }
  .cookie-actions { display: flex; gap: 0.5rem; flex: none; }
  .cookie-actions button {
    appearance: none;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    height: 2.4rem;
    padding: 0 1rem;
    border-radius: 999px;
    cursor: pointer;
  }
  .cookie-actions [data-cookie="accept"] {
    background: #0a0a0a;
    color: #fff;
    border: 1px solid #0a0a0a;
  }
  .cookie-actions [data-cookie="decline"] {
    background: #fff;
    color: #0a0a0a;
    border: 1px solid #d4d4d4;
  }
  body.cookie-open { padding-bottom: 6.5rem; }
  @media (max-width: 640px) {
    .cookie-notice {
      flex-direction: column;
      align-items: stretch;
      left: 0.6rem;
      right: 0.6rem;
      bottom: 0.6rem;
    }
    .cookie-actions button { flex: 1; }
    body.cookie-open { padding-bottom: 9.5rem; }
  }
`.trim();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function page({ title, description, body, foot = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#ffffff" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <style>${css}</style>
  <script>if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('motion');</script>
</head>
<body>
${cookieNoticeHtml}
<script>${cookieNoticeScript}</script>
${body}
${foot}
<script>${fadeScript}</script>
</body>
</html>
`;
}

const cookieNoticeHtml = `  <aside class="cookie-notice" id="cookie-notice" hidden>
    <p>This site uses one cookie to remember your plan between pages. <a href="/privacy/">Privacy policy</a></p>
    <div class="cookie-actions">
      <button type="button" data-cookie="decline">Decline</button>
      <button type="button" data-cookie="accept">Accept</button>
    </div>
  </aside>`;

const cookieNoticeScript = `
  (function () {
    var choiceName = 'bharris_cookie';
    var planName = 'bharris_plan';
    var maxAge = 60 * 60 * 24 * 180;
    function suffix() {
      return '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    }
    function readChoice() {
      var parts = document.cookie ? document.cookie.split('; ') : [];
      var row = '';
      for (var i = 0; i < parts.length; i += 1) {
        if (parts[i].indexOf(choiceName + '=') === 0) row = parts[i];
      }
      if (!row) return '';
      var value = decodeURIComponent(row.slice(choiceName.length + 1));
      return value === 'accepted' || value === 'declined' ? value : '';
    }
    function writeChoice(value) {
      document.cookie = choiceName + '=' + value + suffix() + '; Max-Age=' + maxAge;
    }
    var banner = document.getElementById('cookie-notice');
    if (!banner) return;
    function closeBanner() {
      banner.hidden = true;
      document.body.classList.remove('cookie-open');
    }
    if (readChoice()) {
      closeBanner();
      return;
    }
    banner.hidden = false;
    document.body.classList.add('cookie-open');
    banner.querySelector('[data-cookie="accept"]').addEventListener('click', function () {
      writeChoice('accepted');
      closeBanner();
      window.dispatchEvent(new Event('bharris-cookies-accepted'));
    });
    banner.querySelector('[data-cookie="decline"]').addEventListener('click', function () {
      writeChoice('declined');
      document.cookie = planName + '=' + suffix() + '; Max-Age=0';
      closeBanner();
      window.dispatchEvent(new Event('bharris-cookies-declined'));
    });
  })();
`.trim();

const fadeScript = `
  if (!document.documentElement.classList.contains('motion')) {
    /* Reduced motion: leave everything visible. */
  } else {
    var nodes = document.querySelectorAll('.reveal');
    function visible(el) {
      var rect = el.getBoundingClientRect();
      var view = window.innerHeight || document.documentElement.clientHeight;
      return rect.bottom > 0 && rect.top < view * 0.92;
    }
    function scan() {
      nodes.forEach(function (el) {
        if (!el.classList.contains('in') && visible(el)) el.classList.add('in');
      });
    }
    requestAnimationFrame(function () {
      document.documentElement.classList.add('motion-ready');
      scan();
      window.addEventListener('scroll', scan, { passive: true });
      window.addEventListener('resize', scan);
    });
  }
`.trim();

function inlineHtml(text) {
  return legalRuns(text).map((run) => {
    if (run.kind === 'strong') return `<strong>${escapeHtml(run.value)}</strong>`;
    if (run.kind === 'email') {
      const email = escapeHtml(run.value);
      return `<a href="mailto:${email}">${email}</a>`;
    }
    return escapeHtml(run.value);
  }).join('');
}

function paragraphsHtml(paragraphs) {
  return paragraphs.map((paragraph) => `      <p>${inlineHtml(paragraph)}</p>`).join('\n');
}

function tableHtml(table) {
  if (!table?.headers?.length) return '';
  const head = table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  return `      <div class="legal-table-wrap"><table class="legal-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function blockHtml(section, heading) {
  const copy = legalCopy(section);
  const items = copy.items.length
    ? `      <ul>\n${copy.items.map((item) => `        <li>${inlineHtml(item)}</li>`).join('\n')}\n      </ul>`
    : '';
  const groups = (section.groups || []).map((group) => blockHtml(group, 'h5')).join('\n');
  const title = section.title ? `      <${heading}>${escapeHtml(section.title)}</${heading}>` : '';
  return [title, paragraphsHtml(copy.before), items, tableHtml(section.table), groups, paragraphsHtml(copy.after)]
    .filter(Boolean)
    .join('\n');
}

function sectionsHtml(sections) {
  return sections.map((section) => blockHtml(section, 'h4')).join('\n');
}

function siteFooter() {
  return `  <footer class="site-footer">
    <div class="footer-hero">
      <h2>Time waits for no one, neither should you.</h2>
      <p>Value your time. Download <a href="/app/">bharris.app</a>.</p>
    </div>
    <div class="footer-base">
      <div class="footer-brand">
        <p class="name">bharris.app</p>
        <p class="line">You don't need more time. You just need to use it.</p>
        <p class="copy">© 2026 bharris.app</p>
      </div>
      <div class="footer-cols">
        <div class="footer-col">
          <h3>Product</h3>
          <a href="/#home">Home</a>
          <a href="/#modes">Features</a>
          <a href="/philosophy/">Core philosophy</a>
          <a href="/plans/">Plans</a>
          <a href="/contact/">Contact &amp; FAQ</a>
        </div>
        <div class="footer-col">
          <h3>Legal</h3>
          <a href="/terms/">Terms</a>
          <a href="/privacy/">Privacy</a>
        </div>
        <div class="footer-col">
          <h3>Contact</h3>
          <a href="mailto:broderickharris11@gmail.com">broderickharris11@gmail.com</a>
        </div>
        <div class="footer-col">
          <h3>Socials</h3>
          <span>[social 1]</span>
          <span>[social 2]</span>
        </div>
      </div>
    </div>
  </footer>`;
}

function navBar({ prefix = '', back = '/' } = {}) {
  const here = prefix || '';
  const signIn = `/app/#/account/signin?return=${encodeURIComponent(back)}`;
  return `  <nav class="bar reveal">
    <a class="brand" href="${here}#home">bharris.app</a>
    <div class="bar-links">
      <div class="bar-cluster bar-cluster-left">
        <a href="${here}#home">Home</a>
        <a href="${here}#modes">Features</a>
      </div>
      <div class="bar-cluster bar-cluster-right">
        <a href="/plans/">Plans</a>
        <a href="/contact/">Contact &amp; FAQ</a>
      </div>
    </div>
    <div class="bar-end">
      <span class="bar-auth-wait" id="site-auth-wait" hidden><span class="spin" aria-hidden="true"></span></span>
      <a class="bar-signin" id="site-sign-in" href="${signIn}" hidden>Sign in</a>
      <a class="bar-signin" id="site-account" href="/account/" hidden>Account</a>
      <a class="bar-open" href="/app/">Open bharris.app</a>
    </div>
  </nav>`;
}

function siteAuthFoot(firebaseConfig) {
  const siteAccount = readFileSync(path.join(root, 'scripts', 'site-account.js'), 'utf8');
  const siteAuth = readFileSync(path.join(root, 'scripts', 'site-auth.js'), 'utf8')
    .replace(
      "import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';",
      `import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';\n${siteAccount}`,
    );
  return `<script>window.BH_SITE = ${JSON.stringify(firebaseConfig)};</script>
<script type="module">
${siteAuth}
</script>`;
}

const HOME_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20h-6v-6H10v6H4z"></path></svg>`;

function assistedPhone() {
  return `<div class="phone portrait" aria-hidden="true">
            <div class="screen">
              <span class="island"></span>
              <span class="grip"></span>
              <div class="ph-head">
                <span class="ph-home">${HOME_ICON}</span>
                <span class="ph-titles">
                  <span class="ph-kicker">Must know</span>
                  <span class="ph-name">bharris.app</span>
                </span>
                <span class="ph-stat">62%</span>
                <span class="ph-stat">4:12</span>
              </div>
              <div class="ph-body">
                <div class="ph-row"><span>Must know</span><span>Round 1</span></div>
                <div class="ph-card">
                  <span class="ph-label">Term</span>
                  <p class="ph-term">4th Amendment</p>
                  <p class="ph-hint">Reveal the definition, then grade yourself.</p>
                </div>
                <div class="ph-btn">Show answer</div>
              </div>
            </div>
          </div>`;
}

function spacedPhone() {
  return `<div class="phone portrait" aria-hidden="true">
            <div class="screen">
              <span class="island"></span>
              <span class="grip"></span>
              <div class="ph-head">
                <span class="ph-home">${HOME_ICON}</span>
                <span class="ph-titles">
                  <span class="ph-kicker">Sitting 2 · Free recall</span>
                  <span class="ph-name">bharris.app</span>
                </span>
                <span class="ph-stat">3/10</span>
              </div>
              <div class="ph-body ph-write">
                <div class="ph-row"><span>Free recall</span><span>3/10</span></div>
                <span class="ph-label" style="margin-top:0.7em">Term</span>
                <p class="ph-term">5th Amendment</p>
                <p class="ph-hint">Write the definition from memory.</p>
                <div class="ph-field">Due process, and you don’t have to testify against yourself.</div>
                <div class="ph-btn">Show answer</div>
              </div>
            </div>
          </div>`;
}

function trueCramPhone() {
  return `<div class="phone portrait" aria-hidden="true">
            <div class="screen">
              <span class="island"></span>
              <span class="grip"></span>
              <div class="ph-land">
                <div class="ph-head">
                  <span class="ph-home">${HOME_ICON}</span>
                  <span class="ph-titles">
                    <span class="ph-kicker">First pass</span>
                    <span class="ph-name">Rights</span>
                  </span>
                  <span class="ph-stat">4 / 10</span>
                </div>
                <div class="cockpit">
                  <div class="ph-list">
                    <p class="ph-cat">Rights</p>
                    <div class="ph-item done"><span class="ph-n">1</span><span>1st Amendment</span></div>
                    <div class="ph-item done"><span class="ph-n">2</span><span>2nd Amendment</span></div>
                    <div class="ph-item done"><span class="ph-n">3</span><span>3rd Amendment</span></div>
                    <div class="ph-item on"><span class="ph-n">4</span><span>4th Amendment</span></div>
                    <div class="ph-item"><span class="ph-n">5</span><span>5th Amendment</span></div>
                  </div>
                  <div class="ph-main">
                    <span class="ph-label">Term</span>
                    <p class="ph-term">4th Amendment</p>
                    <span class="ph-label" style="margin-top:14px">Definition</span>
                    <p class="ph-def">No unreasonable searches.</p>
                    <div class="ph-actions">
                      <div class="ph-btn ghost">Missed</div>
                      <div class="ph-btn">Got it</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>`;
}

function brainScan(view) {
  const side = view !== 'top';
  const src = side ? '/brain-side.png' : '/brain-top.png';
  const label = side ? 'Side view of a human brain' : 'Top view of a human brain';
  return `<img src="${src}" alt="${label}" width="1024" height="768">`;
}

function homePage(firebaseConfig) {
  const brainScript = readFileSync(path.join(root, 'scripts', 'brain-learn.js'), 'utf8');
  const mockupScript = readFileSync(path.join(root, 'scripts', 'mockup-scrub.js'), 'utf8');
  return page({
    title: 'bharris.app',
    description: 'Time is money, so we will make sure not to waste yours.',
    foot: `<script>${brainScript}</script><script>${mockupScript}</script>
${siteAuthFoot(firebaseConfig)}`,
    body: `${navBar({ back: '/' })}
  <section id="home" class="hero">
    <h1 class="reveal">bharris.app</h1>
    <p class="tag reveal" style="--d:90ms">Time is money, so we will make sure not to waste yours.</p>
    <a class="jump reveal" style="--d:180ms" href="#features">
      <span>Jump in</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6"></path>
      </svg>
    </a>
  </section>
  <section class="modes-wrap">
    <div id="features" class="paper-black">
      <div class="paper-slip reveal">
        <h2>Your the best in what you do.<br>Its time your studying follows</h2>
      </div>
      <div class="paper-sheet reveal" style="--d:80ms">
        <div class="paper-nos">
          <div class="paper-no">
            <p>No ads</p>
            <p>No distractions</p>
            <p>No waste</p>
          </div>
          <div class="paper-mock">
            <video id="mockup-scrub" muted playsinline preload="auto" aria-label="bharris.app on iPhone" src="/mockup/phone.mp4?v=2"></video>
          </div>
          <p class="paper-back">So you can<br>get back to<br>what you do<br>best</p>
        </div>
      </div>
      <div class="paper-close reveal" style="--d:120ms">
        <p class="paper-procrastination">Procrastination was never an option</p>
        <p class="paper-skip">So we skipped the search to study</p>
        <a class="paper-down" href="#modes" aria-label="Studying modes">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6"></path>
          </svg>
        </a>
      </div>
    </div>
    <div id="modes" class="paper-rest">
      <div class="paper-modes-head reveal" style="--d:140ms">
        <h2>Our studying modes</h2>
        <p class="paper-sub">Adapting to you as you work</p>
      </div>
    <div class="mode-grid">
      <article class="mode-card reveal" style="--d:60ms">
        <h3>Independent Assisted</h3>
        <p>Flashcards on the terms that matter, then a practice test.</p>
        <div class="mode-stage">
          ${assistedPhone()}
        </div>
      </article>
      <article class="mode-card true-cram reveal" style="--d:140ms">
        <h3>True Cram</h3>
        <p>A partner quizzes every term, then flashcards, a practice test, or explain it.</p>
        <div class="true-stage">
          <div class="turn bleed-right">
            ${trueCramPhone()}
          </div>
          <p class="partner-copy">Study with a partner.</p>
          <div class="turn bleed-left">
            ${trueCramPhone()}
          </div>
        </div>
      </article>
      <article class="mode-card reveal" style="--d:220ms">
        <h3>Spaced Cram</h3>
        <p>Recall, review quizzes, and writing the definition. The same terms come back overnight.</p>
        <div class="mode-stage">
          ${spacedPhone()}
        </div>
      </article>
    </div>
    </div>
  </section>
  <section id="brain" class="block brain-wrap">
    <h2 class="reveal">How the brain learns</h2>
    <div class="brain-split">
      <div class="brain-copy reveal" style="--d:60ms">
        <p><strong>Learning works best when the brain has to work.</strong> Research on learning shows that actively retrieving information and working through appropriately challenging questions helps strengthen memory. The goal isn’t to make studying harder for the sake of it—it’s to create the <em>right</em> amount of difficulty: challenging enough to require thinking, but not so difficult that the learner becomes overwhelmed. This idea is known as <strong>desirable difficulty</strong>.</p>
        <p><strong>A cleaner environment leaves more room for learning.</strong> Cognitive Load Theory suggests that our working memory has limited capacity. When an interface is cluttered with unnecessary buttons, information, and distractions, part of that capacity is spent figuring out the interface instead of learning. By removing unnecessary complexity, bharris.app reduces <strong>extraneous cognitive load</strong>, helping you focus your attention on what actually matters: the material.</p>
      </div>
      <div class="brain-scans reveal" style="--d:120ms">
        <div class="scan">${brainScan('side')}</div>
        <div class="scan">${brainScan('top')}</div>
      </div>
    </div>
    <div class="brain-sticky reveal" style="--d:80ms">
      <div class="brain-pair">
        <div class="brain-card-col">
          <div class="brain-dash">
            <div id="brain-sim"></div>
          </div>
        </div>
        <div class="brain-sticky-copy">
          <h3>When the last couple of flashcards don’t click</h3>
          <p>Make your own definition so the term is more memorable. If you still don’t get it, you can have it explained or used in an example.</p>
        </div>
      </div>
    </div>
  </section>
${siteFooter()}`,
  });
}

function policyPage({ title, description, intro, sections, path, firebaseConfig }) {
  return page({
    title: `${title} · bharris.app`,
    description,
    foot: siteAuthFoot(firebaseConfig),
    body: `${navBar({ prefix: '/', back: path })}
  <main class="block doc legal-page reveal">
    <h2>${escapeHtml(title)}</h2>
    <p class="updated">Effective ${escapeHtml(LEGAL_UPDATED)}</p>
${(Array.isArray(intro) ? intro : [intro]).filter(Boolean).map((line) => `    <p>${inlineHtml(line)}</p>`).join('\n')}
    <p class="updated">Last updated ${escapeHtml(LEGAL_UPDATED)}</p>
${sectionsHtml(sections)}
  </main>
${siteFooter()}`,
  });
}

const FAQ = [
  {
    q: 'What is bharris.app?',
    a: 'A cram app for the hours before an exam. Photograph your notes, type them, or start from the sample set. It pulls out the terms and builds a plan around the time you have.',
  },
  {
    q: 'Which mode should I use?',
    a: 'Independent Assisted is flashcards on the terms that matter, then a practice test. True Cram is a partner quiz of every term, then flashcards, a practice test, or explain it. Spaced Cram is for an exam that isn’t the same day: recall, quizzes, and writing the definition, with the same terms coming back overnight.',
  },
  {
    q: 'What does it cost?',
    a: 'Free includes 5 AI calls a month and 10 saved sessions. Study is $8 a month, with 30 AI calls and the last 30 sessions. Partner study is $12 a month and covers one friend. A plan bought in the app or on the website is the plan on both.',
  },
  {
    q: 'How does a partner code work?',
    a: 'You get one private code. A friend signs in and redeems it. Reset the code if it leaks, and the old one stops working. When the subscription ends, paid access ends for both of you.',
  },
  {
    q: 'What counts toward the AI quota?',
    a: 'Term extraction, definitions, triage, grading, explanations, panic notes, and wrong answers for multiple-choice questions. Only a successful call counts. Those answers can be wrong. Check important facts against your class materials.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Delete account in Settings removes that login, your notes, and your sessions, and cancels the Stripe subscription. It does not cancel an App Store subscription. Photos of your notes are not kept.',
  },
];

function philosophyPage(firebaseConfig) {
  return page({
    title: 'Core philosophy · bharris.app',
    description: 'Why bharris.app keeps studying focused and difficult only where it needs to be.',
    foot: siteAuthFoot(firebaseConfig),
    body: `${navBar({ prefix: '/', back: '/philosophy/' })}
  <main class="philosophy-page reveal">
    <h1>Core philosophy</h1>
    <div class="philosophy-copy">
      <p>This app is built for people who value their time. It removes distractions, unnecessary complexity, and ads so users can focus on what actually matters: learning.</p>
      <p>Every part of the app is designed to be difficult only where it needs to be—the studying should challenge you, not the process of navigating the app. The goal is to make studying feel effortless to start and simple to navigate, while still requiring real effort where it counts.</p>
      <p>This app isn’t made for people who are lazy; it’s made for hardworking, forward-thinking people who put their effort into many areas of their lives and don’t want to spend hours figuring out how to study. It exists to make studying more efficient, more focused, and more worth their time.</p>
    </div>
  </main>
${siteFooter()}`,
  });
}

function contactPage(firebaseConfig) {
  const items = FAQ.map((item) => `        <article class="faq-item">
          <h3>${escapeHtml(item.q)}</h3>
          <p>${escapeHtml(item.a)}</p>
        </article>`).join('\n');
  return page({
    title: 'Contact · bharris.app',
    description: 'Contact bharris.app and read answers to common questions.',
    foot: siteAuthFoot(firebaseConfig),
    body: `${navBar({ prefix: '/', back: '/contact/' })}
  <main class="contact-page reveal">
    <div class="contact-head">
      <h1>Contact</h1>
      <p class="contact-email"><a href="mailto:broderickharris11@gmail.com">broderickharris11@gmail.com</a></p>
      <p class="lede">Questions about the app, a plan, or your account.</p>
    </div>
    <section class="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">FAQ</h2>
      <div class="faq-grid">
${items}
      </div>
    </section>
  </main>
${siteFooter()}`,
  });
}

const STUDY_FEATURES = [
  'Photo, typed, or sample notes turned into terms and definitions',
  'Triage that sorts what you know from what you don’t',
  'True Cram for large sets',
  'Spaced Cram when the exam is not the same day',
  'Independent Assisted study at your own pace',
  'One more pass: flashcards, write the definition, a practice test, or explain it',
  'Study AI for extraction, definitions, triage, grading, explanations, and panic notes — 30 calls a month',
  'The last 30 cram sessions saved on your account',
];

const REDEEM_POINTS = [
  'Get a code from someone on partner study',
  'Sign in before you redeem',
  'The code uses letters, numbers, and symbols',
  'Type it exactly, then redeem',
  'It works for one friend',
  'You get the same study features',
  'A reset makes the old code stop working',
  'If they cancel, you both lose access',
];

function featureList(items) {
  return `<ul>\n${items.map((item) => `          <li>${escapeHtml(item)}</li>`).join('\n')}\n        </ul>`;
}

function loadSiteEnv() {
  const env = { ...process.env };
  for (const name of ['.env', '.env.local']) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!env[key]) env[key] = value;
    }
  }
  return env;
}

function browserScript(name) {
  return readFileSync(path.join(root, 'scripts', name), 'utf8').replace(/^export /gm, '');
}

function plansPage(firebaseConfig) {
  const planMarks = browserScript('plan-marks.js');
  const accountPlan = browserScript('account-plan.js');
  const siteAccount = readFileSync(path.join(root, 'scripts', 'site-account.js'), 'utf8');
  const plansClient = readFileSync(path.join(root, 'scripts', 'plans-client.js'), 'utf8')
    .replace(
      "import { getAuth, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';",
      `import { getAuth, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';\n${accountPlan}\n${planMarks}\n${siteAccount}`,
    );
  return page({
    title: 'Plans · bharris.app',
    description: 'Study is $8 a month. Partner study is $12 a month and covers one friend.',
    body: `${navBar({ prefix: '/', back: '/plans/' })}
  <main class="block plans-wrap reveal">
    <h2>Plans</h2>
    <p class="note renew-note">${escapeHtml(RENEWAL_NOTICE)}</p>
    <label class="agree" for="terms-agree">
      <input id="terms-agree" type="checkbox" />
      <span>I agree to the <a href="/terms/">Terms of Service</a> and <a href="/privacy/">Privacy Policy</a>.</span>
    </label>
    <div class="plan-grid">
      <article class="plan-card">
        <h3>Study</h3>
        <p class="price">$8<span> / month</span></p>
        ${featureList(STUDY_FEATURES)}
        <button class="plan-btn" id="solo-subscribe" type="button">Subscribe</button>
        <p class="plan-current" id="solo-current" hidden>Current</p>
        <p class="note" id="solo-note" hidden>You're on Study.</p>
      </article>
      <article class="plan-card">
        <h3>Partner study</h3>
        <p class="price">$12<span> / month</span></p>
        ${featureList(STUDY_FEATURES)}
        <div class="how">
          <h4>How it works</h4>
          <ol>
            <li>You pay $12 a month and get one private code.</li>
            <li>A friend signs in on this page and redeems it.</li>
            <li>If the code leaks, reset it. The old code stops working right away.</li>
            <li>When the subscription ends, you and your friend both lose paid access.</li>
          </ol>
        </div>
        <button class="plan-btn" id="partner-subscribe" type="button">Subscribe</button>
        <p class="plan-current" id="partner-current" hidden>Current</p>
        <div id="partner-owner" hidden>
          <p class="note">Your code</p>
          <p class="plan-code" id="partner-code"></p>
          <div class="plan-actions">
            <button class="plan-btn secondary" id="copy-code" type="button">Copy</button>
            <button class="plan-btn secondary" id="reset-code" type="button">Reset code</button>
            <button class="plan-btn secondary" id="remove-partner" type="button" hidden>Remove partner</button>
          </div>
        </div>
        <p class="note" id="guest-note" hidden>You're on a friend's partner study plan. If they cancel, you both lose access.</p>
      </article>
      <section class="plan-card" id="redeem">
        <h3>Redeem partner code</h3>
        ${featureList(REDEEM_POINTS)}
        <form class="stack" id="redeem-form">
          <input id="redeem-code" name="code" autocomplete="off" spellcheck="false" placeholder="Partner code" aria-label="Partner code" />
          <button class="plan-btn" type="submit">Redeem</button>
          <p id="redeem-status" role="status"></p>
        </form>
      </section>
    </div>
    <div class="promo">
      <label for="promo-code">Code</label>
      <input id="promo-code" name="code" autocomplete="off" spellcheck="false" placeholder="Optional" aria-label="Code" />
    </div>
    <p class="note" id="beta-ended" hidden>Your free week ended.</p>
    <p id="plans-status" role="status"></p>
    <button class="plan-btn secondary" id="manage" type="button" hidden>Manage subscription</button>
    <dialog class="sign-in" id="sign-in-dialog">
      <p class="mark">bharris.app</p>
      <h3>Sign in first</h3>
      <p>Sign in to subscribe or redeem a partner code. You'll come right back to this page.</p>
      <a class="plan-btn" href="/app/#/account/signin?return=/plans/">Sign in</a>
      <button class="text-btn" id="sign-in-close" type="button">Not now</button>
    </dialog>
  </main>
${siteFooter()}`,
    foot: `<script>window.BH_PLANS = ${JSON.stringify(firebaseConfig)};</script>
<script type="module">
${plansClient}
</script>`,
  });
}

function accountPage(firebaseConfig) {
  const accountPlan = browserScript('account-plan.js');
  const siteAccount = readFileSync(path.join(root, 'scripts', 'site-account.js'), 'utf8');
  const accountClient = readFileSync(path.join(root, 'scripts', 'account-client.js'), 'utf8')
    .replace(
      "} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';",
      `} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';\n${accountPlan}\n${siteAccount}`,
    );
  return page({
    title: 'Account · bharris.app',
    description: 'Your bharris.app account, plan, billing, and password.',
    body: `${navBar({ prefix: '/', back: '/account/' })}
  <main class="block account-page reveal">
    <h2>Account</h2>
    <p id="account-loading" class="wait-row" role="status"><span class="spin" aria-hidden="true"></span> Loading your account</p>
    <section id="account-signed-out" hidden>
      <p>Sign in to see your plan, billing, and password.</p>
      <a class="plan-btn" href="/app/#/account/signin?return=/account/">Sign in</a>
    </section>
    <div id="account-signed-in" hidden>
      <section class="plan-card">
        <h3>Your account</h3>
        <dl class="account-rows">
          <div><dt>Name</dt><dd id="account-name">—</dd></div>
          <div><dt>Email</dt><dd id="account-email">—</dd></div>
        </dl>
      </section>
      <section class="plan-card">
        <h3>Plan</h3>
        <p class="account-plan-name" id="account-plan">…</p>
        <p class="note" id="account-price" hidden></p>
        <div class="account-lines" id="account-lines"></div>
        <div class="account-partner" id="account-partner" hidden>
          <p>Partner code</p>
          <div class="account-code">
            <span id="account-code"></span>
            <button class="account-copy" id="account-copy" type="button" hidden>Copy</button>
          </div>
        </div>
        <div class="account-actions">
          <button class="plan-btn" id="account-billing" type="button" hidden>Billing information</button>
          <a class="plan-btn secondary" id="account-plans" href="/plans/" hidden>See plans</a>
          <button class="plan-btn danger" id="account-cancel" type="button" hidden>Cancel plan</button>
        </div>
      </section>
      <section class="plan-card account-password">
        <h3>Password</h3>
        <button class="plan-btn secondary" id="account-password-open" type="button" hidden>Change password</button>
        <p class="note" id="account-password-note" hidden>This account signs in with Google or Apple, so there is no password to change.</p>
      </section>
      <div class="account-actions">
        <button class="plan-btn secondary" id="account-sign-out" type="button">Sign out</button>
        <button class="plan-btn danger" id="account-delete" type="button">Delete account</button>
      </div>
      <p class="account-status" id="account-status" role="status"></p>
    </div>
    <dialog class="sign-in password" id="account-password-dialog" aria-labelledby="account-password-title">
      <p class="mark">bharris.app</p>
      <h3 id="account-password-title">Change password</h3>
      <form class="account-password" id="account-password-form">
        <label for="account-current-password">Current password</label>
        <input id="account-current-password" type="password" autocomplete="current-password" />
        <label for="account-new-password">New password</label>
        <input id="account-new-password" type="password" autocomplete="new-password" minlength="8" />
        <label for="account-confirm-password">Confirm new password</label>
        <input id="account-confirm-password" type="password" autocomplete="new-password" minlength="8" />
        <button class="plan-btn" id="account-password-save" type="submit">Save password</button>
      </form>
      <p class="account-status" id="account-password-status" role="status"></p>
      <button class="text-btn" id="account-password-close" type="button">Not now</button>
    </dialog>
  </main>
${siteFooter()}`,
    foot: `<script>window.BH_ACCOUNT = ${JSON.stringify(firebaseConfig)};</script>
<script type="module">
${accountClient}
</script>`,
  });
}

function thanksPage(firebaseConfig) {
  const siteAccount = readFileSync(path.join(root, 'scripts', 'site-account.js'), 'utf8');
  const thanksClient = readFileSync(path.join(root, 'scripts', 'thanks-client.js'), 'utf8')
    .replace(
      "import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';",
      `import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';\n${siteAccount}`,
    );
  return page({
    title: 'Thank you · bharris.app',
    description: 'Thank you for choosing bharris.app.',
    body: `  <main class="thanks">
    <h1>Thank you for choosing bharris.app</h1>
    <p>Let's get studying.</p>
    <section class="thanks-partner" id="partner-thanks" hidden>
      <h2>Here's your partner code</h2>
      <div class="thanks-code-row">
        <p class="thanks-code-value" id="partner-thanks-code"></p>
        <button class="thanks-copy" id="partner-thanks-copy" type="button" aria-label="Copy code" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect width="8" height="4" x="8" y="2" rx="1"></rect>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          </svg>
        </button>
      </div>
      <p class="thanks-manage">You can find and manage this code in <a href="/app/#/settings">Settings</a>.</p>
    </section>
    <a class="thanks-open" href="/app/">Open bharris.app</a>
  </main>`,
    foot: `<script>window.BH_THANKS = ${JSON.stringify(firebaseConfig)};</script>
<script type="module">
${thanksClient}
</script>`,
  });
}

function redirectPage({ title, dest }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · bharris.app</title>
  <link rel="canonical" href="${dest}" />
  <meta http-equiv="refresh" content="0; url=${dest}" />
  <script>location.replace(${JSON.stringify(dest)});</script>
</head>
<body>
  <p><a href="${dest}">${escapeHtml(title)}</a></p>
</body>
</html>
`;
}

await rm(webDir, { recursive: true, force: true });
await mkdir(path.join(webDir, 'app'), { recursive: true });
await cp(distDir, path.join(webDir, 'app'), { recursive: true });
await mkdir(path.join(webDir, 'mockup'), { recursive: true });
await cp(path.join(root, 'site', 'mockup', 'phone.mp4'), path.join(webDir, 'mockup', 'phone.mp4'));
await cp(path.join(root, 'site', 'brain-side.png'), path.join(webDir, 'brain-side.png'));
await cp(path.join(root, 'site', 'brain-top.png'), path.join(webDir, 'brain-top.png'));
const siteEnv = loadSiteEnv();
const firebaseConfig = {
  apiKey: siteEnv.VITE_FIREBASE_API_KEY || '',
  authDomain: siteEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: siteEnv.VITE_FIREBASE_PROJECT_ID || '',
  appId: siteEnv.VITE_FIREBASE_APP_ID || '',
};
await writeFile(path.join(webDir, 'index.html'), homePage(firebaseConfig));
await mkdir(path.join(webDir, 'plans'), { recursive: true });
await writeFile(path.join(webDir, 'plans', 'index.html'), plansPage(firebaseConfig));
await mkdir(path.join(webDir, 'account'), { recursive: true });
await writeFile(path.join(webDir, 'account', 'index.html'), accountPage(firebaseConfig));
await mkdir(path.join(webDir, 'thanks'), { recursive: true });
await writeFile(path.join(webDir, 'thanks', 'index.html'), thanksPage(firebaseConfig));
await mkdir(path.join(webDir, 'philosophy'), { recursive: true });
await writeFile(path.join(webDir, 'philosophy', 'index.html'), philosophyPage(firebaseConfig));
await mkdir(path.join(webDir, 'contact'), { recursive: true });
await writeFile(path.join(webDir, 'contact', 'index.html'), contactPage(firebaseConfig));
await mkdir(path.join(webDir, 'legal'), { recursive: true });
await writeFile(
  path.join(webDir, 'legal', 'index.html'),
  redirectPage({ title: 'Privacy Policy', dest: '/privacy/' }),
);
await mkdir(path.join(webDir, 'privacy'), { recursive: true });
await mkdir(path.join(webDir, 'terms'), { recursive: true });
await writeFile(
  path.join(webDir, 'privacy', 'index.html'),
  policyPage({
    title: 'Privacy Policy',
    description: 'How bharris.app handles your account, notes, photos, and study AI.',
    intro: PRIVACY_LEAD,
    sections: PRIVACY_SECTIONS,
    path: '/privacy/',
    firebaseConfig,
  }),
);
await writeFile(
  path.join(webDir, 'terms', 'index.html'),
  policyPage({
    title: 'Terms of Service',
    description: 'The rules for using bharris.app.',
    intro: TERMS_LEAD,
    sections: TERMS_SECTIONS,
    path: '/terms/',
    firebaseConfig,
  }),
);
