/**
 * The privacy policy and terms, shown at /privacy and /terms (public, also the App Store's
 * privacy policy URL). Keep them true: when what we store, the hosting or the AI providers
 * change (AI_PROVIDER, apps/api/src/ai/ai-providers.ts), update the text and `updated`.
 */

export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDocument = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

export const REPOSITORY_URL = 'https://github.com/sbm2310/fandex';
export const FEEDBACK_URL = `${REPOSITORY_URL}/issues/new`;

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy policy',
  updated: 'October 19, 2026',
  intro:
    'Fandex is a small, independent app for keeping track of a collection. This page explains what it stores about you, who else handles it, and how to take it with you or delete it. There are no ads and no tracking.',
  sections: [
    {
      heading: 'Without an account',
      paragraphs: [
        'You can use Fandex without signing in. Your collection is then kept only on your device (in the browser’s local storage on the web) and never sent to us. Searches still go through the Fandex server, which asks the catalogs on your behalf.',
      ],
    },
    {
      heading: 'What we store when you have an account',
      paragraphs: [
        'Your name and email address, your password, which is stored only as a one-way hash, and the currency you chose for new pre-orders.',
        'Your sessions: when you signed in, the device’s browser or app description (user agent) and its IP address, so you stay signed in and can be protected against abuse.',
        'Your collection: the items you add, the corrections you make to them, figures you create by hand (including any image link you give), your pre-orders with their prices, payments, dates and notes, and figure suggestions you send for the shared catalog.',
        'How many AI features you used each day (counts only), to enforce the daily allowance.',
      ],
    },
    {
      heading: 'Photos and questions sent to AI',
      paragraphs: [
        'When you scan a shelf or a figure box, the photo is resized on your device and sent to an AI provider to read the titles. Fandex never stores the photo. The scan screen names the provider before you send it: currently Google Gemini, with Groq as a backup. On Google’s free tier, Google may use what it receives to improve its products; Groq doesn’t.',
        'When you ask your collection a question, only the question (and the list of universes Fandex knows) is sent to an AI provider, currently Groq. Your collection itself is never sent to an AI provider.',
      ],
    },
    {
      heading: 'Who else handles your data',
      paragraphs: [
        'Render hosts the Fandex server (in the United States) and Neon hosts its database. They store and process data only to run the service.',
        'Book, LEGO and series searches are sent to Open Library, Rebrickable and Wikidata. They receive what you search for, not who you are.',
        'Book covers and LEGO images load directly from Open Library’s and Rebrickable’s servers, which therefore see your IP address, as with any website.',
        'Fandex doesn’t sell or share your data with anyone else, and doesn’t use analytics or advertising services.',
      ],
    },
    {
      heading: 'Cookies and storage on your device',
      paragraphs: [
        'Fandex uses one cookie, to keep you signed in (on the phone it is kept in the system’s secure storage). Your device also keeps a copy of your collection so the app loads quickly.',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        'You can change your name and password on the Account tab, and delete your account there at any time. Deleting it removes your account, sessions, collection, pre-orders, hand-made figures and usage counts right away. Figures you suggested that were accepted into the shared catalog stay in it, without your name.',
        'You can download your collection from the Account tab at any time, as a JSON file (everything, pre-orders too) or a CSV file for spreadsheets.',
        'The Account tab also lists the devices you are signed in on (by device type, without IP addresses) and lets you sign any of them out.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'Fandex isn’t meant for children under 13, and we don’t knowingly collect their data.',
      ],
    },
    {
      heading: 'Changes and contact',
      paragraphs: [
        'If this policy changes, the new version will appear here with a new date. Questions or requests: open an issue on Fandex’s GitHub page (linked from the Account tab).',
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: 'Terms of use',
  updated: 'October 18, 2026',
  intro:
    'Fandex is a free app, offered as it is. By using it you agree to these terms. If you don’t, please don’t use it.',
  sections: [
    {
      heading: 'Your account',
      paragraphs: [
        'Keep your password safe: Fandex can’t recover a forgotten password yet. You are responsible for what happens under your account. You can delete it at any time on the Account tab.',
      ],
    },
    {
      heading: 'Using Fandex fairly',
      paragraphs: [
        'Don’t misuse the service: no attempts to break into other accounts or the server, no automated scraping, and no use that overloads it. AI features have daily limits so they stay available to everyone.',
      ],
    },
    {
      heading: 'What you add',
      paragraphs: [
        'Your collection is yours. When you suggest a figure for the shared catalog, you let Fandex publish its facts (name, maker, number, dates, price) to everyone, edited as needed, without your name. Only suggest facts, not text or pictures copied from others.',
      ],
    },
    {
      heading: 'Catalog information',
      paragraphs: [
        'Book, LEGO and series information comes from Open Library, Rebrickable and Wikidata; figure facts are written by Fandex from public sources. They can be incomplete or wrong, and AI readings of photos can be mistaken: check before you rely on them, for example for a purchase.',
        'Product names, characters and brands belong to their owners. Fandex isn’t affiliated with or endorsed by any of them.',
      ],
    },
    {
      heading: 'No warranty',
      paragraphs: [
        'Fandex is provided without any warranty. It may change, be unavailable, or stop, and features may be added or removed. To the extent the law allows, Fandex isn’t liable for any loss from using it, including lost data, so keep your own records of anything important.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'These terms may change; the new version will appear here with a new date. Continuing to use Fandex after a change means you accept it.',
      ],
    },
  ],
};
