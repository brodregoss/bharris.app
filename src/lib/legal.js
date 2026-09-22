export const APP_NAME = 'Last Minute Study';
export const APP_VERSION = '1.0.0';

export const ABOUT_SECTIONS = [
  {
    title: 'What this is',
    body: 'Last Minute Study is a cram app for the hours before an exam. Photograph your notes, pull out the terms, triage what you actually know, then drill until the clock runs out.',
  },
  {
    title: 'How it works',
    body: 'You set how much time you have and what kind of test it is. The app builds a plan around that — flashcards, a practice test, and a last-pass review. Sample notes are included if you want to try it without your own pages.',
  },
  {
    title: 'AI',
    body: 'Term extraction from photos, definition writing, panic notes, and answer grading go through a Cloudflare Worker that calls OpenAI. Those features count toward a monthly AI quota. They can be wrong. Treat them as a study aid, not the answer key.',
  },
];

export const PRIVACY_SECTIONS = [
  {
    title: 'Account',
    body: 'You sign in with Firebase (email and password, Apple, or Google). That account id is how notes, study progress, and AI quota are stored on the server.',
  },
  {
    title: 'What stays with your account',
    body: 'Study sessions, term definitions, grades, and uploaded note files are stored for your account so you can pick up on another device. Original photos go to private object storage; the app only sees them through signed-in requests.',
  },
  {
    title: 'What leaves your device',
    body: 'If you photograph notes (up to two pages), those images are uploaded so terms and definitions can be extracted. Panic notes, definition generation, and practice-test grading send the relevant terms and answers to the same server, which forwards them to OpenAI. We do not sell this content.',
  },
  {
    title: 'Camera and photos',
    body: 'The camera and photo library are used only when you choose to add a picture of your notes.',
  },
  {
    title: 'Deleting your data',
    body: 'Signing out leaves your cloud data in place. Starting a new cram replaces the active session. Content already sent for an AI request cannot be pulled back from that provider.',
  },
];

export const TERMS_SECTIONS = [
  {
    title: 'Using the app',
    body: 'Last Minute Study is for personal studying. An account is required. Built-in sample notes are for trying the app, not a complete course.',
  },
  {
    title: 'No academic guarantee',
    body: 'The app does not promise a grade, credit, or that any definition is complete or correct. Check important facts against your class materials.',
  },
  {
    title: 'AI output',
    body: 'Generated terms, definitions, panic notes, and graded answers can be incomplete or wrong. You are responsible for how you use them.',
  },
  {
    title: 'Your notes',
    body: 'Only upload notes you have a right to use. Do not submit other people’s unpublished work or anything you are not allowed to share with a third-party service.',
  },
  {
    title: 'Provided as-is',
    body: 'The app is provided as-is, without warranties of any kind. Features may change. If you do not agree, do not use the app.',
  },
];
