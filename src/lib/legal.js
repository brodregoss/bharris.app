export const APP_NAME = 'bharris.app';
export const APP_VERSION = '1.0.0';

export const ABOUT_SECTIONS = [
  {
    title: 'What this is',
    body: 'bharris.app is a cram app for the hours before an exam. Photograph your notes, pull out the terms, triage what you actually know, then drill until the clock runs out.',
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
    body: 'You sign in with Firebase using email and password, Apple, or Google. That account id is how your notes, study progress, subscription status, and monthly AI quota are stored. We receive the name and email your sign-in provider shares.',
  },
  {
    title: 'What we store',
    body: 'Study sessions, term lists, definitions, grades, and note files stay with your account so you can pick up on another device. If you add photos of your notes, those images are kept in private storage and are only available through signed-in requests. We do not store your card number.',
  },
  {
    title: 'Camera and photos',
    body: 'The camera and photo library are used only when you choose to add a picture of your notes. You can attach up to two photos. Those images are uploaded so terms can be pulled out of them.',
  },
  {
    title: 'Study AI',
    body: 'Term extraction, definition writing, triage, practice grading, explanations, and panic notes go through our server, which sends the relevant photo, terms, or answers to OpenAI. Those requests count toward a monthly AI quota. We do not sell this content. Material already sent for an AI request cannot be pulled back from that provider.',
  },
  {
    title: 'Payments',
    body: 'Study is $8 per month. Partner study is $12 per month and covers one friend who redeems your code. The app and the website share the same account, so a plan bought on either one is the plan on both. Stripe bills the plan until you cancel it in the app or on the plans page. The price is shown before you pay. The beta code starts one free week and is not charged. When that week ends, access ends. A separate free trial, if one is offered, asks for a card and the plan price starts when the trial ends. If you cancel partner study, paid access ends for you and your friend when the paid period ends. Resetting a partner code makes the old code stop working. An older App Store subscription, if you still have one, is billed by Apple and cancelled in your Apple ID subscriptions. We receive whether your plan is active, not your payment card.',
  },
  {
    title: 'Cookies',
    body: 'The website shows a notice where you can accept or decline cookies. If you accept, it keeps one cookie, bharris_plan, so it can remember your plan while you move between pages. That cookie stores your account id, the plan name (Free, Study, or Partner study), and, only for partner study, the partner code and whether a friend has redeemed it. It does not store your name, email, notes, photos, or payment card. It is not used for advertising. It lasts until you sign out or close the browser. Signing out deletes it. A second cookie, bharris_cookie, stores only your choice, accepted or declined, so the notice stays closed on later visits. If you decline, the site does not remember your plan between pages and checks it when a page needs it.',
  },
  {
    title: 'What we do not do',
    body: 'We do not sell your notes, account, or study history. We do not use your notes to advertise to you. We do not use advertising or analytics cookies.',
  },
  {
    title: 'Deleting your data',
    body: 'Delete account in Settings removes that login, your notes, stored photos, and your sessions. Signing out leaves cloud data in place. Starting a new cram replaces the active session.',
  },
  {
    title: 'Children',
    body: 'bharris.app is not directed at children under 13. Do not create an account if you are under 13.',
  },
  {
    title: 'Changes',
    body: 'We may update this policy as the app changes. The current version is the one on this page.',
  },
  {
    title: 'Contact',
    body: 'Questions about this policy: [contact email].',
  },
];

export const TERMS_SECTIONS = [
  {
    title: 'Using the app',
    body: 'bharris.app is for personal studying. An account is required. You bring notes, triage what you know, then study in True, Spaced, or Independent mode, with one more pass if you want it. Built-in sample notes are for trying the app, not a complete course.',
  },
  {
    title: 'Plans',
    body: 'A free plan is available with a smaller monthly AI quota. Study is $8 per month and Partner study is $12 per month, in the app and on the website. A plan bought on either one is the plan on both. Partner study includes one friend: you get a code, they redeem it, and if you reset that code the old one stops working. The beta code starts one free week and is not charged. When that week ends, access ends. A separate free trial, if one is offered, asks for a card and the plan price starts when the trial ends. Canceling partner study ends paid access for both of you when the paid period ends. These plans are billed by Stripe until you cancel them in the app or on the plans page. An older App Store subscription, if you still have one, is billed by Apple and cancelled in your Apple ID subscriptions.',
  },
  {
    title: 'Cookies',
    body: 'The website shows a notice where you can accept or decline cookies. Accepting lets the site remember your plan between pages. If you decline, the site does not remember your plan between pages. The privacy policy describes both cookies. The site does not use advertising or analytics cookies.',
  },
  {
    title: 'No academic guarantee',
    body: 'The app does not promise a grade, credit, or that any definition is complete or correct. Check important facts against your class materials.',
  },
  {
    title: 'AI output',
    body: 'Generated terms, definitions, panic notes, explanations, and graded answers can be incomplete or wrong. You are responsible for how you use them. AI features count toward your monthly quota.',
  },
  {
    title: 'Your notes',
    body: 'Only upload notes you have a right to use. Do not submit other people’s unpublished work, or anything you are not allowed to share with a third-party service such as the study AI.',
  },
  {
    title: 'Your account',
    body: 'You are responsible for activity on your account. You can sign out at any time. Delete account in Settings removes that login and the notes and sessions stored for it.',
  },
  {
    title: 'Provided as-is',
    body: 'The app is provided as-is, without warranties of any kind. Features, quotas, and modes may change. If you do not agree, do not use the app.',
  },
  {
    title: 'Changes',
    body: 'We may update these terms as the app changes. The current version is the one on this page. Continuing to use the app after an update means you accept the current terms.',
  },
  {
    title: 'Contact',
    body: 'Questions about these terms: [contact email].',
  },
];
