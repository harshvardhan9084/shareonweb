import type { AppArticle, ArticleSection, HomeArticle } from '@/lib/article-types'
import { LIVE_ARTICLES } from '@/lib/articles-live'
import { INSTANT_ARTICLES } from '@/lib/articles-instant'

// The merged article set: every tool page renders its article below the
// action. Missing entries fall back to an honest minimum built from the
// registry, so a page can never render empty.

export const APP_ARTICLES: Record<string, AppArticle> = {
  ...LIVE_ARTICLES,
  ...INSTANT_ARTICLES,
}

export function getArticle(appId: string): AppArticle | undefined {
  return APP_ARTICLES[appId]
}

// ---------------------------------------------------------------------------
// The homepage narrative. Written for a brand-new visitor conceiving of this
// place for the first time: what it is, what actually happens to your data,
// and why it is built this way. Importance-ordered, long-form on purpose.
// ---------------------------------------------------------------------------

export const HOME_ARTICLE: HomeArticle = {
  lede: [
    'This is a toolbox that works the way the web was supposed to: you open the page and the tool is already there, running, ready. Zip a folder, verify a download, format some JSON, move photos from your phone to your laptop, open a video room for six people. No account, no install, no plan to pick.',
    'And the rule underneath all of it, the one everything else follows: nothing you do here lands on a server. Instant tools compute on your device with the browser\u2019s own engines, so the file is never sent anywhere. Live tools pass content directly between the devices in the session. When a session ends it is discarded, and it never existed on our side to begin with.',
  ],
  sections: [
    {
      heading: 'What actually happens when you zip a file here',
      paragraphs: [
        'You drop a folder onto the page. The browser reads the files from your disk, compresses them in memory, and hands you back a ZIP as a download. That is the entire journey: disk, memory, download.',
        'There is no upload step, because there is no code on the page that could upload. You can watch the network tab and see it: the only requests are for the page itself. The folder crosses no network, so nobody can store, scan, index or leak it. The most confidential folder you have and a folder of cat photos get exactly the same treatment: they never leave.',
      ],
    },
    {
      heading: 'What actually happens in a live session',
      paragraphs: [
        'Live tools are the ones that connect devices: Share moves files and text between your phone and your laptop, Call opens a video room, Screen shows your display to someone else. These need a relay at the start, the way two phones need a signal to find each other. The relay\u2019s whole job is introductions; it never holds your content.',
        'After the introduction, the content flows directly between the devices in the session. Your photos travel phone to laptop. Your voice travels microphone to speaker. There is no storage bucket holding your files, no profile holding your name, no tracker mining what you shared. The relay knows a code was live and when it expired; that is the entire record.',
        'When the session ends, by your hand or by the 24-hour expiry, everything in it is discarded. The code stops working. On our side, there is nothing to delete, because nothing was ever stored.',
      ],
    },
    {
      heading: 'The short version of the promise',
      paragraphs: [
        'Everything above reduces to five facts, and every page on this site keeps all five:',
      ],
      list: [
        'No accounts anywhere',
        'No ads, no trackers',
        'Instant: files never leave your device',
        'Live: content dies with the session',
        'Free, with no plans to pick',
      ],
    },
    {
      heading: 'Why it is built this way',
      paragraphs: [
        'Because the alternative is worse in every direction. A cloud tool that holds your files needs accounts to attach files to names, storage that costs money to justify paywalls, and a database that becomes the single most valuable target in the company. The business pressure of that architecture always ends the same way: your data as collateral in someone else\u2019s monetization.',
        'This architecture has no such pressure. There is no database of your content to sell access to, no retention to fund, no account system to breach. Privacy is not a setting you toggle here; it is a property of how the tools are built. That is also why everything is free without a plan picker: with no storage bill, there is nothing to charge for.',
        'It is faster, too. Instant tools finish at the speed of your own CPU because the work is local: no upload queue, no server round trip, no \u201Cprocessing\u201D spinner that is really a transfer. Live tools feel direct because they are direct.',
      ],
    },
    {
      heading: 'What a session is, exactly',
      paragraphs: [
        'A session is a temporary room with one artifact: a six-character code, rendered like K7T-29Q. It opens with one click on a live tool, and everyone you hand it to joins from their browser by link, QR or the code itself. No account for you, none for them.',
        'Sessions expire after 24 hours at the longest, or end sooner when you end them. Recent rooms are remembered only on your own device, so a mistaken back-click never strands you. When the code no longer works, nothing of the session remains to find.',
      ],
    },
    {
      heading: 'Who this is for',
      paragraphs: [
        'For the moment you need the thing now, on whatever device is in your hand, without creating a relationship with a software company first. Zip the folder. Verify the download. Send the photos. Meet for ten minutes. Close the tab and go on with your day, leaving nothing behind anywhere.',
        'The catalog grows around real intentions rather than around a platform\u2019s feature grid: tools get built when the ordinary ways of doing something are heavier than the task itself. If the ordinary way is fine, this site has no opinion; if it costs an upload, an install or an account for a two-minute job, this site exists for exactly that job.',
      ],
    },
  ] satisfies ArticleSection[],
}
