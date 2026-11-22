// Per-tool SEO/GEO copy and FAQs — the "every tool ranks on its own search
// terms" layer. Written per tool, not templated: search engines and answer
// engines reward specific, honest phrasing, and each tool page should read
// like its own product. All claims here mirror actual app behavior.
//
// Keys are tool ids ('beam', 'call', …). Mode-specific FAQs stay keyed under
// the variant ids ('drop', 'video-call', …) and surface when that mode is
// picked on the tool's landing page.

import type { AppDef } from '@/lib/registry'

export interface Faq {
  q: string
  a: string
}

/** Hand-tuned search titles (the blue link) — intent-first, tool-named. */
const SEO_TITLES: Record<string, string> = {
  beam: 'Beam — send text, files and folders between devices instantly',
  call: 'Call — video and voice rooms with a link, no accounts',
  screen: 'Screen — share your screen live, or see theirs, from the browser',
  camera: 'Camera — live camera sharing, phone webcam, baby monitor',
  voice: 'Voice — walkie-talkie, wireless mic and live recorder in the browser',
  notepad: 'Notepad — write notes and code together, live',
  present: 'Present — slides on every screen, clicker on your phone',
  canvas: 'Canvas — draw together on a live whiteboard',
  roundtable: 'Roundtable — a quick room for chat and live polls',
  'co-browse': 'Collaborative Browsing — browse the same page together',
  'location-share': 'Live Location — share where you are, live',
  'live-captions': 'Live Captions — caption and translate speech',
}

/** Hand-tuned meta descriptions (the snippet) — honest, specific, ~150 chars. */
const SEO_DESCRIPTIONS: Record<string, string> = {
  beam:
    'Move text, files and whole folders between your phone and computer directly, up to 50 MB per file. One QR scan pairs two devices. Nothing stored, no account.',
  call:
    'One-click video or voice rooms for two people or a small group: meetings, interviews, classrooms, webinars. Everyone joins from a browser. Nothing recorded.',
  screen:
    'Share a tab, window or whole screen from the browser, watch your PC on your phone, or guide someone through a fix. Peer-to-peer, nothing recorded.',
  camera:
    'Stream what your camera sees, use a phone as a wireless webcam, or turn two devices into a consent-first baby monitor. Live, direct and temporary.',
  voice:
    'Push-to-talk between devices like real walkie-talkies, use a phone as a PC microphone, or record while everyone listens live. Nothing kept afterwards.',
  notepad:
    'One live document on every device: shared notes that sync as you type, plus a pair-programming mode with highlighting and snapshots. No accounts.',
  present:
    'Present slides while the audience follows on their phones at full quality, and drive the deck from your phone. No upload, no signup, nothing stored.',
  canvas:
    'A shared whiteboard that opens in every browser. Draw together from a phone, tablet or laptop with strokes syncing live. Nothing saved afterwards.',
  roundtable:
    'Open a room, share the six-character code and run a quick discussion with live chat and instant polls. No accounts, room expires on its own.',
  'co-browse':
    'Open a web page in a session and everyone sees the same page and scroll. Works with sites that allow embedding; logins stay on your side.',
  'location-share':
    'Share your live position with people in the session, from your browser. Only session members see it; nothing is stored afterwards.',
  'live-captions':
    'Live captions for speech in the session, with translation built in. Runs in the browser; speech recognition support varies by browser.',
}

/**
 * Per-tool FAQs. Mode-specific entries keep the variant ids as keys and are
 * shown on the landing page when that mode is selected; the tool-level entries
 * ship in structured data for the tool page.
 */
export const APP_FAQS: Record<string, Faq[]> = {
  // ------------------------------------------------------------- tool-level
  beam: [
    {
      q: 'Are my files uploaded to a server?',
      a: 'No. Text, files and folders travel through the live session directly between the devices in it, and they are discarded when the session ends. The 50 MB per-file limit exists because the transfer runs peer-to-peer.',
    },
    {
      q: 'What happens if the connection drops mid-transfer?',
      a: 'ShareOnWeb reconnects on its own, and failed files stay queued on your side so you can resend them with one tap once the link is back.',
    },
    {
      q: 'How do I send text, a file and a folder without re-inviting myself?',
      a: 'Start with the Quick Pair mode: scan the QR with your other device and both stay in one session where you can beam text and files from a single surface.',
    },
  ],
  call: [
    {
      q: 'Do my guests need to install anything?',
      a: 'No. Everyone joins from a browser with the code, the link or the QR, on a phone or a computer. No accounts anywhere.',
    },
    {
      q: 'Are meetings recorded?',
      a: 'No. There is no recording and no cloud storage; when the session ends, it is gone.',
    },
    {
      q: 'Is the video routed through a server?',
      a: 'The connection is set up through our relay, but the video and audio flow directly between the browsers whenever the networks allow it.',
    },
  ],
  screen: [
    {
      q: 'Can I share just one tab instead of my whole screen?',
      a: 'Yes. Your browser’s picker offers tabs, windows and entire screens. Pick the narrowest thing that does the job; nothing leaves the session.',
    },
    {
      q: 'Can the helper control the other device?',
      a: 'No, and that is deliberate. Remote Assist sees the shared view and talks the person through the fix; their device stays theirs.',
    },
    {
      q: 'What does the viewer need?',
      a: 'A browser and the session code. They watch live on any device, including a phone.',
    },
  ],
  camera: [
    {
      q: 'Is the video stored anywhere?',
      a: 'No. Streams exist only between the devices in the session and disappear when it ends. The baby and pet monitor adds explicit consent and loud disconnect alerts on top.',
    },
    {
      q: 'How does the phone become a webcam?',
      a: 'Open the session on your computer, join from the phone with the code, allow the camera, and the phone’s video appears on the computer as a webcam source.',
    },
  ],
  voice: [
    {
      q: 'How does push-to-talk work?',
      a: 'Hold the button to talk, release to listen, on any device in the session. It behaves like real walkie-talkies, so nobody talks over anybody.',
    },
    {
      q: 'Where do my recordings go?',
      a: 'They live inside the session and can be downloaded from it. Nothing is kept on our side once the session ends or expires.',
    },
    {
      q: 'Why use a phone as a microphone?',
      a: 'Phone mics are usually better than laptop mics, and this works even if the computer has no mic at all. The phone joins the session and its audio lands on the computer.',
    },
  ],
  notepad: [
    {
      q: 'Can several people type at the same time?',
      a: 'Yes, it is one live document. Everyone in the session writes into the same note and sees the others as they type — in prose or in the code mode.',
    },
    {
      q: 'Is the note saved for later?',
      a: 'Nothing is stored on our side. Copy the note out (or keep the session alive) before you end it; ending the session discards the text.',
    },
    {
      q: 'Does the code mode need any setup or extensions?',
      a: 'No. It opens in the browser like every tool here. Create a session, share the code, and you are editing together with highlighting and snapshots.',
    },
  ],
  present: [
    {
      q: 'Can the audience follow on their phones?',
      a: 'That is the main setup: you present from your laptop, everyone else opens the session code on their phone and sees the current slide live.',
    },
    {
      q: 'Are my slides uploaded anywhere?',
      a: 'No. Slides travel through the live session at full quality and exist only on the devices in it.',
    },
    {
      q: 'Can I control slides from my phone?',
      a: 'Yes: join the same session on your phone and it becomes the remote — next, back, blank and a live pointer for the audience.',
    },
  ],
  canvas: [
    {
      q: 'Can I draw on Canvas from a phone?',
      a: 'Yes. Canvas is touch-first: draw with a finger or stylus on phones and tablets, or with the mouse on a laptop, and every stroke reaches the other devices live.',
    },
    {
      q: 'Is the whiteboard saved anywhere?',
      a: 'No. The board lives only while the session does. If you want to keep it, export or screenshot before you end the session.',
    },
  ],
  roundtable: [
    {
      q: 'How do I get people into a Roundtable room?',
      a: 'Share the six-character code, the link or the QR code. They join in a browser: no app, no account.',
    },
    {
      q: 'What is Roundtable good for?',
      a: 'Short, ad-hoc discussions: a quick stand-up, a decision, a class check-in. Chat keeps the context and polls settle questions in seconds.',
    },
  ],
  'co-browse': [
    {
      q: 'Does Collaborative Browsing work with every website?',
      a: 'With sites that allow being shown inside a session page. Some (banks, portals with strict security) refuse to be embedded and cannot be co-browsed.',
    },
    {
      q: 'Do the other people see my logins?',
      a: 'No. You browse as yourself on your side; the session shares the page and scroll, not your credentials.',
    },
  ],
  'location-share': [
    {
      q: 'Who can see my location?',
      a: 'Only the devices in that session, and only while it runs. There is no history: when the session ends, the position is discarded.',
    },
    {
      q: 'Can I see everyone on a map?',
      a: 'Yes. Every live position is plotted on one map inside the tool, with accuracy circles and an expiry on each; classic Google Maps and OpenStreetMap links stay available for navigation.',
    },
  ],
  'live-captions': [
    {
      q: 'Which browsers support the captions?',
      a: 'Speech recognition in the browser varies: Chrome and Edge currently give the best results, and the tool tells you honestly when your browser cannot caption.',
    },
    {
      q: 'Can it translate while captioning?',
      a: 'Yes, captions can be translated live for other people in the session, so a mixed-language room can still follow along.',
    },
  ],

  // ------------------------------------------------------------ mode-level
  drop: [
    {
      q: 'What happens if a file fails halfway?',
      a: 'ShareOnWeb reconnects on its own, and the failed file stays queued on your side so you can resend it with one tap once the link is back.',
    },
    {
      q: 'Why is there a 50 MB per-file limit?',
      a: 'Because files travel directly between browsers, not through a storage server. No cloud, no account — that trade keeps your files private.',
    },
  ],
  'folder-share': [
    {
      q: 'Does the folder structure survive the transfer?',
      a: 'Yes, nested subfolders arrive exactly as they left. The receiving device can download everything as a single ZIP or grab files one by one.',
    },
    {
      q: 'How big can a folder be?',
      a: 'Each file can be up to 50 MB, and there is no limit on the number of files. The tab must stay open on both devices while the transfer runs.',
    },
  ],
  'quick-pair': [
    {
      q: 'What does pairing actually do?',
      a: 'It puts two devices into the same live session instantly, so you can move to the real work (files, text) without typing a code on the second device.',
    },
    {
      q: 'Does it use Bluetooth?',
      a: 'No. Pairing runs over the web like everything else on ShareOnWeb: the second device joins through a link or QR, so it works across networks, not just in the same room.',
    },
  ],
  'video-call': [
    {
      q: 'How many people can a two-person call hold?',
      a: 'It is built for two devices; that is what keeps the media direct between browsers. For a group, pick the Group Meeting mode.',
    },
  ],
  'audio-call': [
    {
      q: 'Why choose a voice-only call?',
      a: 'It is much lighter on battery and mobile data than video, and it opens faster, which is good for a long talk on a weak connection.',
    },
  ],
  'interview-room': [
    {
      q: 'What does the candidate need?',
      a: 'Just the link or code and a browser. No account, no download, no calendar magic, which is exactly what you want for a one-off interview.',
    },
  ],
  classroom: [
    {
      q: 'How do students join the class?',
      a: 'You share the six-character code or QR; they type it in at the top of the site or scan it. No sign-up, so a class can be running in under a minute.',
    },
    {
      q: 'Can I show my screen to the class?',
      a: 'Yes. Share a tab, a window or the whole screen, and students follow live on their own devices.',
    },
  ],
  'webinar-room': [
    {
      q: 'Do viewers need to register?',
      a: 'No. They open the code or link and they are in. The room is temporary and needs no roster.',
    },
  ],
  'remote-assist': [
    {
      q: 'How do I start helping someone?',
      a: 'Open Screen, pick Remote Assist, start a session, and send them the code. They point their camera at the problem; you see it live and guide them.',
    },
  ],
  'guided-pointer': [
    {
      q: 'What does everyone else see when I point?',
      a: 'Your pointer and your marks render live on the shared screen for the whole session, which is useful for “look here” moments during a walkthrough.',
    },
  ],
  'support-session': [
    {
      q: 'What is the difference from plain screen sharing?',
      a: 'A Support Session bundles the pieces a fix actually needs (screen sharing plus the camera) and keeps a transcript of the steps you took.',
    },
  ],
  'walkie-talkie': [
    {
      q: 'Does the tab need to stay open?',
      a: 'Yes, on every device in the session. It runs in the browser, so keep the tab in the foreground while you use it.',
    },
  ],
  'voice-record': [
    {
      q: 'Can others hear the recording while I record?',
      a: 'Yes. People in the session hear it live as you speak, which is the point: share audio without sending files afterwards.',
    },
  ],
  'camera-live': [
    {
      q: 'Can I show my phone’s camera on a laptop?',
      a: 'Yes, that is the classic setup. The laptop opens the session, the phone joins with the code, and the camera streams live.',
    },
  ],
  'baby-monitor': [
    {
      q: 'What if the phone locks its screen?',
      a: 'Some phones pause video when the screen locks. Keep the watcher plugged in and the tab open; if your browser allows it, allow audio/video playback in the background.',
    },
  ],
  'temp-stream': [
    {
      q: 'What is a temporary stream for?',
      a: 'Short-lived moments: a demo, a quick view from a camera, a one-off event. Open the session, stream, close it. Nothing lingers.',
    },
  ],
  'phone-mic': [
    {
      q: 'Is the audio uploaded anywhere?',
      a: 'No. It streams through the live session between your devices only.',
    },
  ],
  'presentation-clicker': [
    {
      q: 'Does it work with PowerPoint or Keynote?',
      a: 'It is built to drive Live Presentation and shared screens inside the session. For desktop apps, share your screen and use the pointer to walk through your deck.',
    },
  ],
  'screen-to-phone': [
    {
      q: 'Can I control the computer from the phone?',
      a: 'No. This is a viewer. Control stays on the computer, which keeps it safe to share the code inside your home or office.',
    },
  ],
  'shared-docs': [
    {
      q: 'Is the shared note saved for later?',
      a: 'Nothing is stored on our side. Copy the note out (or keep the session alive) before you end it; ending the session discards the text.',
    },
  ],
  'code-editor': [
    {
      q: 'Do both people need to open the editor in the same session?',
      a: 'Yes. The editor is live pair-programming: one shared buffer, keystrokes from both sides as they happen.',
    },
  ],
  'live-present': [
    {
      q: 'Are my slides uploaded anywhere?',
      a: 'No. Slides travel through the live session at full quality and exist only on the devices in it.',
    },
  ],
}

/** Home-page FAQs: the questions a first-time visitor asks. */
export const HOME_FAQS: Faq[] = [
  {
    q: 'Is ShareOnWeb really free?',
    a: 'Yes. There are no accounts, no plans and no paywalls: every tool opens straight into a working session.',
  },
  {
    q: 'Do the people I invite need an account?',
    a: 'No. They join with the six-character code, the QR code or the link, from any modern browser, on a phone or a computer.',
  },
  {
    q: 'Where does my content go?',
    a: 'It stays inside the live session. Text, files, boards and chats travel between the devices in the session and are discarded when the session ends or expires. Files sent with Beam never touch a cloud server.',
  },
  {
    q: 'Does it work on phones?',
    a: 'Yes. The tools are built phone-first: touch to draw, camera and mic tools, join-by-QR, and pages that fit a small screen.',
  },
  {
    q: 'Can I use it once and leave?',
    a: 'That is the design. Open the tool, do the thing, close the tab. Sessions expire on their own and nothing about you is kept.',
  },
  {
    q: 'Is there something to install?',
    a: 'Installing is optional. When your browser supports it, an Install button appears; on iPhone the browser offers “Add to Home Screen”. Without installing, everything works the same in the tab.',
  },
]

/** Metadata for one tool URL: title, description, keywords. */
export function appMeta(app: AppDef): {
  title: string
  description: string
  keywords: string[]
} {
  return {
    title: `${SEO_TITLES[app.id] ?? app.name} · ShareOnWeb`,
    description:
      SEO_DESCRIPTIONS[app.id] ?? `${app.tagline} ${app.description}`.slice(0, 158),
    keywords: [
      app.name.toLowerCase(),
      ...(app.variants ?? []).map((v) => v.name.toLowerCase()),
      ...app.intents.slice(0, 10),
    ],
  }
}
