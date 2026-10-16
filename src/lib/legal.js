export const APP_NAME = 'bharris.app';
export const APP_VERSION = '1.0.0';
export const LEGAL_UPDATED = 'October 16, 2026';
export const LEGAL_EMAIL = 'broderickharris11@gmail.com';

function asParagraphs(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function legalCopy(section) {
  return {
    before: asParagraphs(section?.body),
    items: asParagraphs(section?.items),
    after: asParagraphs(section?.after),
  };
}

export function legalRuns(text) {
  const value = String(text || '');
  const runs = [];
  const re = /\*\*([^*]+)\*\*|(broderickharris11@gmail\.com)/g;
  let last = 0;
  let match = re.exec(value);
  while (match) {
    if (match.index > last) runs.push({ kind: 'text', value: value.slice(last, match.index) });
    if (match[1]) runs.push({ kind: 'strong', value: match[1] });
    else runs.push({ kind: 'email', value: LEGAL_EMAIL });
    last = match.index + match[0].length;
    match = re.exec(value);
  }
  if (last < value.length) runs.push({ kind: 'text', value: value.slice(last) });
  if (!runs.length) runs.push({ kind: 'text', value });
  return runs;
}

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

export const TERMS_LEAD = [
  'These Terms of Service ("Terms") govern your use of bharris.app, including the website at https://bharris.broderickharris11.workers.dev and the iPhone application (collectively, the "Service"). The Service is operated by an individual in the United States, not a corporation or other separate business entity.',
  'By creating an account, accessing features that require an account, purchasing a subscription, or using the Service, you agree to these Terms. If you do not agree, do not use the Service.',
  'For questions about these Terms, contact broderickharris11@gmail.com.',
];

export const TERMS_SECTIONS = [
  {
    title: '1. What bharris.app Does',
    body: 'bharris.app is an exam-cram and study-planning tool designed to help users study more efficiently when preparing for a test. Users can enter study material by typing notes, scanning notes with a photo, or using an included sample set. The Service can extract terms, generate definitions, assess study progress, and create study activities. Study activities may include flashcards, writing definitions, practice tests, explanations, and other study exercises. Some content and study assistance are generated using artificial intelligence.',
    items: [
      'True Cram is an in-person quiz where another person quizzes the user on their terms. This feature is separate from the paid Partner study plan.',
      'Spaced Cram brings terms back for another study session, including overnight scheduling when appropriate.',
      'Independent Assisted guides the user through important terms, flashcards, and a practice test.',
    ],
  },
  {
    title: '2. AI-Generated Content',
    body: [
      'The Service uses artificial intelligence to assist with tasks such as generating definitions, grading answers, creating explanations, generating multiple-choice wrong answers, triaging terms, and creating panic notes.',
      'AI-generated information may be incomplete, inaccurate, misleading, or inappropriate for a particular assignment or subject.',
      'You are responsible for reviewing AI-generated content before relying on it for schoolwork, studying, testing, or any other purpose.',
      'The Service is a study aid and **does not guarantee that any definition, explanation, question, answer, or other AI-generated content is correct**.',
      'You should verify important information using your class materials, textbooks, teachers, official sources, or other reliable sources.',
    ],
  },
  {
    title: '3. Your Account',
    body: [
      'Studying requires an account. The website and iPhone application use the same account.',
      'You must be at least 18 years old to use the Service, or between 13 and 17 with parental or guardian permission. Do not create an account if you are under 13. The Service does not check age at sign-up.',
      'You may edit your display name, up to 80 characters.',
      'You are responsible for:',
    ],
    items: [
      'Providing accurate information when creating your account.',
      'Keeping access to your account secure.',
      'Not sharing your account credentials with unauthorized people.',
      'Not using another person\'s account without permission.',
      'Not attempting to bypass account, subscription, usage, or security restrictions.',
    ],
  },
  {
    title: '4. User Content',
    body: [
      'You may provide notes, terms, definitions, study material, answers to questions, photos of notes, and other information entered into study sessions.',
      'You retain ownership of the content you provide.',
      'You give the Service permission to process, store, transmit, and display your content as reasonably necessary to provide the Service, including processing content through third-party service providers described in the Privacy Policy.',
      'You should not upload information that you do not have permission to share.',
      'You should also avoid uploading highly sensitive personal information that is unnecessary for studying.',
    ],
  },
  {
    title: '5. Photo Scanning',
    body: [
      'The Service allows you to scan notes using photos.',
      'Photos are currently limited to two images per scan, with a maximum size of 12 MB per image.',
      'During scanning, the original photo is held temporarily in memory, sent through the Service\'s server, and forwarded to the AI service used to process the scan. The current production system does not maintain a permanent photo-storage bucket.',
      'The text extracted from the photo, including titles, terms, and definitions, may be retained as part of your notes.',
      'Scanning is currently behind a notes password that the server checks. The app does not save that password. The server stores a hash of it, not the password itself.',
    ],
  },
  {
    title: '6. Subscriptions and Plans',
    body: 'The Service currently offers the following plans. A plan bought on the website or in the iPhone app is the plan on both.',
    table: {
      headers: ['Plan', 'Price', 'AI calls / month', 'Saved finished sessions'],
      rows: [
        ['Free', '$0', '5', '10'],
        ['Study', '$8/month', '30', '30'],
        ['Partner study', '$12/month', '30', '30'],
      ],
    },
    after: [
      'Limits and plan features may change in the future.',
      'The active study session is not counted against the saved-session limit. Older completed sessions may be removed once the applicable limit is reached.',
      'AI usage resets at the beginning of each calendar month in UTC. Only a successful AI call counts toward that monthly limit. A failed call does not.',
    ],
  },
  {
    title: '7. Payments and Renewals',
    body: [
      'Website purchases are processed through Stripe Checkout.',
      'Before completing a purchase, the checkout process displays the applicable price and recurring renewal information.',
      'Paid subscriptions automatically renew unless canceled before the next renewal. You can cancel in the app or on the plans page. The Stripe customer portal can also update your card and show invoices.',
      'Canceling a subscription prevents the next charge. Unless required otherwise by applicable law, payments already made are not refunded, and access generally continues through the period that has already been paid for.',
      'Price changes may apply to a future renewal after the new price is presented to you.',
    ],
  },
  {
    title: '8. Partner Study',
    body: [
      'Partner study allows a subscription owner to invite one friend using a private partner code.',
      'The partner receives access to the same study features included with the applicable Partner study plan.',
      'Only one friend may redeem the active code.',
      'Resetting a partner code invalidates the previous unused code. A friend who has already redeemed a code stays on the plan until their access is otherwise ended.',
      'If you cancel, your friend keeps access until the end of the period already paid for, and then you both lose it. Removing your friend ends their access right away, and you keep the plan.',
      'By redeeming a Partner study code, the partner agrees to these Terms and the Privacy Policy.',
    ],
  },
  {
    title: '9. Trials and Promotional Offers',
    body: [
      'A beta promotional code may provide one free week of access without requiring a payment card. The promotion is limited to one use per account and does not automatically renew. When that week ends, access ends. It does not become a paid plan.',
      'If a user cancels the promotional access during the free period, access ends immediately.',
      'If a separate paid-card free trial is offered, the applicable checkout terms will explain when the trial ends and when payment begins. Unless canceled before the trial ends, the subscription may automatically begin charging according to those terms.',
      'Promotional offers may be changed, limited, or discontinued at any time.',
    ],
  },
  {
    title: '10. App Store Subscriptions',
    body: [
      'An older App Store subscription may remain supported through Apple and RevenueCat.',
      'App Store subscriptions are billed and managed by Apple. The current paywall does not sell a new App Store subscription. New purchases use Stripe.',
      'While an older App Store subscription is still active, the account stays on the paid tier even if the website plan ends.',
      'Deleting your bharris.app account does not automatically cancel an Apple App Store subscription. You must cancel an App Store subscription through Apple.',
    ],
  },
  {
    title: '11. Account Deletion',
    body: [
      'Signing out does not delete the data stored for your account. You may delete your account through Settings.',
      'Deleting your account removes or ends, as applicable:',
    ],
    items: [
      'Your Firebase account',
      'Stored note content',
      'Study sessions',
      'Stored copies of sessions and notes on the Service',
      'The local account-related data maintained by the Service',
      'Your Stripe subscription associated with the account',
      'A friend\'s Partner study access associated with your account',
    ],
    after: [
      'You are responsible for saving anything you want to keep before deleting your account. There is no full-account download.',
      'Account deletion does not cancel an Apple App Store subscription, remove failed Partner study code-attempt records retained for security, or retrieve information that has already been sent to third-party AI providers. It also does not require Stripe to delete records that Stripe is independently required or permitted to retain. Notes-scan password failure counts stored on the account are removed with the account.',
    ],
  },
  {
    title: '12. Acceptable Use',
    body: 'You agree not to:',
    items: [
      'Use the Service for unlawful purposes.',
      'Attempt to gain unauthorized access to another account.',
      'Circumvent subscription or AI usage limits.',
      'Attempt to interfere with the Service or its servers.',
      'Reverse engineer or exploit security features.',
      'Upload malicious code or files.',
      'Abuse Partner study invitation systems, including sharing a partner code publicly or trying to guess partner codes.',
      'Use the Service to distribute content that violates applicable law.',
      'Attempt to access internal development tools or administrative systems without authorization.',
    ],
    after: 'We may suspend or terminate access when reasonably necessary to protect the Service, its users, or its security. Paid access ends when an account is closed for that reason.',
  },
  {
    title: '13. Educational Disclaimer',
    body: [
      'bharris.app is an educational tool. It is not a teacher, school, tutor, testing authority, or academic institution.',
      'The Service does not guarantee a particular grade, a passing score, test readiness, academic improvement, the accuracy of generated material, or that a study plan is appropriate for your particular exam.',
      'You remain responsible for determining what material you need to learn and verifying important information.',
    ],
  },
  {
    title: '14. Availability',
    body: [
      'We try to keep the Service available and functional, but we do not guarantee uninterrupted or error-free operation.',
      'The Service may occasionally be unavailable because of maintenance, technical problems, third-party service outages, updates, security issues, or other circumstances.',
      'Features may be added, changed, limited, or removed over time.',
    ],
  },
  {
    title: '15. Third-Party Services',
    body: [
      'The Service depends on third-party providers, including Firebase, Cloudflare, OpenAI, Stripe, Apple, and RevenueCat.',
      'Those providers operate under their own terms and privacy policies.',
      'The Service may become unavailable or behave differently if a third-party provider experiences an outage, changes its service, or stops supporting a feature.',
    ],
  },
  {
    title: '16. Intellectual Property',
    body: [
      'The Service, including its software, design, branding, original text, graphics, and other original materials, is owned by the Service operator or used with permission.',
      'Except for content you provide yourself, you may not copy, reproduce, modify, distribute, sell, or commercially exploit the Service or its original materials without permission.',
    ],
  },
  {
    title: '17. Disclaimer of Warranties',
    body: [
      'To the maximum extent permitted by applicable law, the Service is provided on an "as is" and "as available" basis.',
      'We do not guarantee that the Service will always be accurate, available, secure, uninterrupted, or free of errors.',
      'To the extent permitted by law, we disclaim warranties not expressly stated in these Terms, including warranties of merchantability, fitness for a particular purpose, and non-infringement. Some places do not allow those disclaimers, and there this does not apply.',
    ],
  },
  {
    title: '18. Limitation of Liability',
    body: [
      'To the maximum extent permitted by applicable law, the Service operator will not be responsible for indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the Service.',
      'This includes, where legally permitted, losses related to grades, exams, missed deadlines, inaccurate study information, loss of data, service interruptions, or reliance on AI-generated content.',
      'Nothing in these Terms is intended to exclude liability that cannot legally be excluded, including liability for fraud or for harm the law does not allow us to limit.',
    ],
  },
  {
    title: '19. Changes to These Terms',
    body: [
      'These Terms may be updated as the Service changes.',
      'When material changes are made, the updated effective date will be shown at the top of this document.',
      'Your continued use of the Service after updated Terms become effective means you accept the updated Terms to the extent permitted by law. A price change applies only at the next renewal. A month you have already paid for stays at the price shown for that purchase.',
    ],
  },
  {
    title: '20. Governing Law',
    body: 'These Terms are governed by the laws applicable in the United States and the state in which the Service operator resides, except where applicable law requires otherwise. This does not take away a right the law says cannot be waived, including a right to contact a consumer protection agency or to use small claims court where you live.',
  },
  {
    title: '21. Contact',
    body: 'Questions about these Terms can be sent to broderickharris11@gmail.com.',
  },
];

export const PRIVACY_LEAD = [
  'This Privacy Policy explains how bharris.app collects, uses, stores, and shares information when you use the website at https://bharris.broderickharris11.workers.dev or the iPhone application.',
  'bharris.app is operated by an individual in the United States, not a corporation or other separate business entity.',
  'For privacy questions or requests, contact broderickharris11@gmail.com.',
];

export const PRIVACY_SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect information that is necessary to operate your account and provide the Service. Depending on how you use the Service, this may include the categories below.',
    groups: [
      {
        title: 'Account information',
        items: [
          'Email address',
          'Display name, which you can edit up to 80 characters',
          'Account ID',
          'Account creation and update times',
          'Sign-in information handled through Firebase',
          'The name and email Google or Apple actually share when you choose those sign-in methods. Apple may hide your real email and often sends your name only the first time.',
          'The time you last opened the app, stored as last_seen_at and updated at most once an hour',
        ],
      },
      {
        title: 'Study information',
        body: 'This information is used to provide your study experience.',
        items: [
          'Note titles, terms, definitions, and note transcripts',
          'Study session information, including the plan and phase',
          'Difficulty, confidence, mastery, grades, and recall history',
          'Panic-note content',
          'Information about how terms were studied',
          'Monthly AI usage: calls used, the limit, and the UTC month',
        ],
      },
      {
        title: 'Subscription information',
        items: [
          'Current plan: Free, Study, Partner study, or a friend\'s seat on someone else\'s Partner study',
          'Stripe customer ID and subscription ID',
          'Subscription status, trial information, and period dates',
          'Cancellation status and promotional-code status',
          'RevenueCat app user ID, which is your account ID, for a supported older App Store subscription',
        ],
        after: 'We do **not** store your full payment-card number.',
      },
      {
        title: 'Security information',
        body: 'For security and abuse prevention, the Service may store:',
        items: [
          'Failed Partner study code attempts, the account ID associated with those attempts, and the time of those attempts',
          'Notes-scan password failure counts and temporary account lock information',
        ],
        after: 'Failed Partner study code-attempt records may remain after account deletion. Notes-scan failure counts are removed when the account is deleted.',
      },
    ],
  },
  {
    title: '2. Information We Do Not Collect',
    body: 'The Service does not intentionally collect:',
    items: [
      'Precise location',
      'Contacts',
      'Microphone recordings',
      'Payment-card numbers',
      'Advertising profiles or third-party advertising analytics',
      'Passwords in plaintext',
    ],
    after: [
      'Notes are not sent to advertising networks.',
      'The Service does not use a third-party analytics product to create an analytics profile about you. The last_seen_at value is used only to count how many accounts were active in the previous seven days.',
      'The Service does not intentionally store your IP address as part of your account record. Cloudflare, as the infrastructure provider, may still receive normal technical request information through its infrastructure and logs.',
    ],
  },
  {
    title: '3. Photos and Note Scanning',
    body: [
      'If you choose to scan notes, the Service temporarily processes the photo so that text and study material can be extracted.',
      'Photos are currently limited to two images per scan, with a maximum size of 12 MB per image.',
      'The current live Worker does not have a configured permanent photo-storage bucket. The original photo is held in memory during processing, sent to the Service\'s server, forwarded to OpenAI for processing, and then discarded.',
      'The Service retains the resulting text, such as titles, terms, and definitions, as part of your stored notes.',
      'Photos are not written to browser or iPhone local storage as part of the normal scanning process.',
      'Scanning is currently behind a notes password. The app does not save that password. The server stores a hash of it, not the password itself. A scan unlock token may sit in website session storage for about eight hours.',
    ],
  },
  {
    title: '4. How We Use Your Information',
    body: 'Information is used to:',
    items: [
      'Create and maintain your account',
      'Authenticate you',
      'Store and retrieve your notes',
      'Save study sessions',
      'Generate study plans and track study progress',
      'Provide AI-generated definitions, explanations, practice questions, incorrect answer choices, grading, and panic notes',
      'Provide spaced-study reminders',
      'Manage subscriptions and enforce plan and usage limits',
      'Prevent abuse of Partner study codes',
      'Protect the security of the Service',
      'Provide customer support',
      'Count how many accounts were active in the previous seven days',
    ],
    after: 'A last_seen_at value may be updated no more than once per hour for that limited activity count. There is no third-party analytics product associated with it. The count itself is available only after the development-tools code is entered.',
  },
  {
    title: '5. Artificial Intelligence',
    body: [
      'The Service uses OpenAI\'s API through a Cloudflare Worker. Requests use the model gpt-4o-mini.',
      'The OpenAI API may receive study information necessary to perform an AI request. Depending on the feature being used, this can include:',
    ],
    items: [
      'A photo being scanned',
      'Terms, and notes written alongside terms',
      'Term lists, including lists used to generate wrong multiple-choice answers',
      'Your answers and the correct definitions, for grading and explanations',
      'The terms you studied and how well you know each one, for panic notes',
    ],
    after: [
      'The Service\'s server does not log the content of these AI requests.',
      'The Service does not sell your study content or use it to train its own AI model.',
      'Once information is transmitted to OpenAI, it is subject to OpenAI\'s handling of that information under OpenAI\'s applicable policies and terms. The Service does not request deletion of individual AI requests from OpenAI after they are sent.',
      'You should avoid submitting highly sensitive information that is unnecessary for your study session.',
      'Only a successful AI call counts toward your monthly quota. A failed call does not. The quota resets at the start of each calendar month in UTC.',
    ],
  },
  {
    title: '6. Third-Party Services',
    body: 'The Service relies on several third-party providers. The app and the website connect to our server over HTTPS.',
    groups: [
      {
        title: 'Firebase / Google',
        body: [
          'Firebase is used for account authentication. Depending on your sign-in method, authentication may involve email and password, Google, or Apple.',
          'Firebase handles account authentication and password storage. We do not store your password.',
          'When you use Google sign-in, Google may provide your email and profile information.',
          'When you use Apple sign-in, Apple may provide your email and name. Apple may also hide your real email address and may only provide your name during the first sign-in.',
          'Password-reset emails are handled through Firebase. If an address has no account, the app tells you so.',
        ],
      },
      {
        title: 'Cloudflare',
        body: [
          'Cloudflare provides infrastructure for the website, API, and database.',
          'Cloudflare hosts or processes information including account data, notes, and study sessions.',
          'Cloudflare may also receive ordinary technical request information through its infrastructure and logs.',
          'The Service does not intentionally store your IP address as part of your account record.',
        ],
      },
      {
        title: 'OpenAI',
        body: 'OpenAI provides the AI processing used by the Service. Information sent to OpenAI can include the study content described under Artificial Intelligence.',
      },
      {
        title: 'Stripe',
        body: [
          'Stripe processes payments for website subscriptions.',
          'Stripe may receive information such as your email address and payment-card information.',
          'The Service does not receive or store your full card number.',
          'Stripe may retain its own records after your bharris.app account is deleted.',
        ],
      },
      {
        title: 'Apple and RevenueCat',
        body: [
          'An older App Store subscription may be checked through RevenueCat.',
          'RevenueCat receives the account ID used to associate that subscription with your bharris.app account.',
          'The current paywall does not sell a new App Store subscription. New purchases use Stripe.',
        ],
      },
    ],
  },
  {
    title: '7. Cookies',
    body: 'The website uses a small number of cookies. The iPhone application does not use these website cookies. The website shows a notice where you can accept or decline.',
    groups: [
      {
        title: 'bharris_cookie',
        body: 'This cookie stores only whether you accepted or declined the website cookie notice. It lasts for 180 days, so the notice stays closed.',
      },
      {
        title: 'bharris_plan',
        body: 'This cookie is written only if you accept the cookie notice. It lasts until you sign out or close the browser. Declining deletes it. Signing out clears it. It may contain:',
        items: [
          'Your account ID',
          'An internal plan code: solo, partner, or guest. A friend\'s seat is stored as guest and shown as Partner study.',
          'Whether the tier is free or paid',
          'For a Partner study owner, the private partner code and whether a friend has redeemed it',
          'A flag if your free week has ended',
        ],
        after: 'It does not contain your name, email address, notes, photos, or payment-card information.',
      },
    ],
    after: 'There are no advertising or analytics cookies. If you decline, the site does not remember your plan between pages and checks it when a page needs it.',
  },
  {
    title: '8. Local Storage and Device Data',
    body: [
      'The website and iPhone application may keep certain information locally on your device, associated with your signed-in account. Firebase also keeps its own sign-in session on the device.',
      'Photos used for scanning are held in memory while the scan is taking place and are not normally saved to local storage.',
    ],
    items: [
      'Your signed-in account and a cached profile',
      'Study sessions, note text, and panic notes',
      'Greeting preferences and onboarding status',
    ],
    after: 'Website session storage may temporarily contain a notes-scan unlock token lasting about eight hours, the page to return to after signing in, and a development-tools unlock flag. Those values are cleared when the tab closes.',
  },
  {
    title: '9. Reminders',
    body: [
      'Spaced Cram may provide a reminder that says "Time for your next sitting" and "Your memory needs this gap to stick." These reminders do not contain your notes.',
      'On iPhone, the reminder is stored as a local notification on the device. On the website, the reminder only operates while the relevant browser tab remains open.',
      'The Service does not currently use a push-notification service.',
    ],
  },
  {
    title: '10. Data Retention',
    body: [
      'We retain information for as long as reasonably necessary to provide the Service, maintain accounts, provide study history, manage subscriptions, maintain security, or comply with legal obligations.',
      'Completed study sessions are subject to the saved-session limit of the applicable plan. Older finished sessions may be removed when the applicable limit is reached. The active session is not counted against that limit.',
      'Monthly AI usage information is retained to enforce monthly limits.',
      'Certain security records, such as failed Partner study code attempts, may be retained even after account deletion.',
      'Third-party providers may retain information according to their own policies and legal obligations.',
    ],
  },
  {
    title: '11. Account Deletion',
    body: 'You may delete your account through Settings. Signing out does not delete your cloud data. When you delete your account, the Service removes or ends, as applicable:',
    items: [
      'Your Firebase account',
      'Stored notes and study sessions',
      'On-device copies associated with the Service',
      'Your Stripe subscription',
      'A friend\'s Partner study access associated with your account',
      'Notes-scan password failure counts stored on the account',
    ],
    after: [
      'Account deletion does not cancel an Apple App Store subscription, delete failed Partner study code-attempt records, or remove information already sent to OpenAI. It does not require Stripe to delete records it independently retains.',
      'There is currently no full-account download feature. You can view your notes and sessions in the Service, and you can change your display name in Settings, before deleting your account.',
    ],
  },
  {
    title: '12. Your Privacy Rights',
    body: [
      'Depending on where you live, you may have legal rights concerning your personal information. These rights may include rights to request access to, correction of, deletion of, or information about the processing of your personal information.',
      'Users in California, the European Union, the European Economic Area, and other jurisdictions with applicable privacy laws may submit privacy requests to broderickharris11@gmail.com. We will evaluate and respond to requests according to applicable law.',
      'Deleting your account in Settings is how the data we hold is removed, with the limits in Account Deletion. We do not sell personal information, and a privacy request does not change your price or your access.',
      'If you are in the EU or EEA, you can also complain to your local data protection authority.',
    ],
  },
  {
    title: '13. California Privacy Information',
    body: [
      'If California privacy law applies to you, you may have rights concerning your personal information, including certain rights to know, delete, correct, or limit certain uses of information.',
      'The Service does not sell your personal information for money. The Service does not use your information to create advertising profiles.',
      'To submit a California privacy request, contact broderickharris11@gmail.com. We may need to verify your identity before completing certain requests.',
    ],
  },
  {
    title: '14. Children\'s Privacy',
    body: [
      'The Service does not check a user\'s age. The Service is **not intended for children under 13**.',
      'Users must be at least 18 years old, or between 13 and 17 with parental or guardian permission.',
      'Do not create an account if you are under 13. If you believe a child under 13 has provided personal information to the Service, contact broderickharris11@gmail.com. We will delete that account.',
    ],
  },
  {
    title: '15. Data Security',
    body: [
      'We take reasonable measures to protect information used by the Service. These measures include server-side authentication, restricted access to server credentials, password hashing where applicable, and controls intended to prevent unauthorized access.',
      'The notes-scan password and the development-tools code are stored as hashes on the server, not as the passwords themselves. The app does not save those passwords.',
      'No internet service or storage system can guarantee absolute security. You should avoid submitting sensitive information that is not necessary for studying.',
    ],
  },
  {
    title: '16. International Data Transfers',
    body: 'The Service operator is located in the United States and uses service providers that may process information in the United States or other locations where those providers operate. By using the Service, you understand that your information may be processed in countries other than the country where you live, subject to applicable law and the practices of the third-party providers described in this Policy.',
  },
  {
    title: '17. Changes to This Privacy Policy',
    body: [
      'This Privacy Policy may be updated as the Service changes.',
      'When changes are made, the updated effective date will be shown at the top of the Policy.',
      'If material changes are made, reasonable notice may be provided through the Service when appropriate.',
    ],
  },
  {
    title: '18. Contact',
    body: 'For privacy questions, requests, or concerns, contact broderickharris11@gmail.com.',
  },
];

export const TERMS_AGREE_ERROR = 'Agree to the Terms of Service and Privacy Policy first.';

export const RENEWAL_NOTICE = 'Study renews at $8 a month. Partner study renews at $12 a month. Each paid plan continues until you cancel in the app or on the plans page. You keep the month you already paid for, and that month is not refunded except where the law requires it. A new price applies at the next renewal, and you can cancel before then.';
