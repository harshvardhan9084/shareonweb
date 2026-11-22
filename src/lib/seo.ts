// Per-tool SEO/GEO copy and FAQs — the "every tool ranks on its own search
// terms" layer. Written per app, not templated: search engines and answer
// engines reward specific, honest phrasing, and each tool page should read
// like its own product. All claims here mirror actual app behavior.

import type { AppDef } from '@/lib/registry'

export interface Faq {
  q: string
  a: string
}

/** Hand-tuned search titles (the blue link) — intent-first, tool-named. */
const SEO_TITLES: Record<string, string> = {
  beam: 'Beam — send text and links between devices instantly',
  drop: 'Drop — send files from phone to computer, no upload',
  'folder-share': 'Folder Share — transfer a whole folder between devices',
  'quick-pair': 'Quick Pair — connect two devices in one tap',
  canvas: 'Canvas — draw together on a live whiteboard',
  roundtable: 'Roundtable — a quick room for chat and live polls',
  'shared-docs': 'Notepad — write the same note together, live',
  'code-editor': 'Pair Code Editor — code together in the browser',
  'live-present': 'Live Presentation — present slides to any device',
  'video-call': 'Private Call — a two-person video call, no accounts',
  'group-meeting': 'Group Meeting — start a video room in one click',
  'audio-call': 'Voice Call — talk between devices in the browser',
  'interview-room': 'Interview Room — a video room for interviews',
  classroom: 'Online Classroom — a live room for teaching',
  'webinar-room': 'Webinar Room — present to an audience, no signup',
  'screen-share': 'Screen Sharing — show your screen live from the browser',
  'remote-assist': 'Remote Assist — guide someone by seeing their camera',
  'co-browse': 'Collaborative Browsing — browse the same page together',
  'guided-pointer': 'Shared Pointer — point and mark up a shared screen',
  'support-session': 'Support Session — help someone, step by step',
  'walkie-talkie': 'Walkie-Talkie — push to talk between devices',
  'voice-record': 'Voice Recorder — record and share audio live',
  'camera-live': 'Live Camera — stream your camera to another device',
  'baby-monitor': 'Baby & Pet Monitor — turn two phones into a monitor',
  'temp-stream': 'Temporary Live Stream — go live for a moment',
  'location-share': 'Live Location — share where you are, live',
  'live-captions': 'Live Captions — caption and translate speech',
  'phone-webcam': 'Phone as Webcam — use your phone camera on your computer',
  'phone-mic': 'Phone as Microphone — your phone mic on your computer',
  'presentation-clicker': 'Presentation Remote — drive slides from your phone',
  'screen-to-phone': 'Screen on Phone — see your computer screen on your phone',
}

/** Hand-tuned meta descriptions (the snippet) — honest, specific, ~150 chars. */
const SEO_DESCRIPTIONS: Record<string, string> = {
  beam:
    'Type or paste a link, address or password and it appears on your other device the moment you send it. No account, no chat app, nothing stored.',
  drop:
    'Move photos and documents between your phone and computer directly, up to 50 MB per file. Files travel through the live session — no cloud, no account.',
  'folder-share':
    'Send an entire folder with its structure intact, then download it back as one ZIP. Runs between browsers in a temporary session. Nothing stored.',
  'quick-pair':
    'Open Quick Pair on two devices and they are in the same live session in one tap — the fastest way to start any ShareOnWeb tool.',
  canvas:
    'A shared whiteboard that opens in every browser. Draw together from a phone, tablet or laptop with strokes syncing live. Nothing saved afterwards.',
  roundtable:
    'Open a room, share the six-character code and run a quick discussion with live chat and instant polls. No accounts, room expires on its own.',
  'shared-docs':
    'A live shared note: everyone in the session types in the same document and sees each other as they write. Copy it out before the session ends.',
  'code-editor':
    'A pair-programming editor in the browser: two people, one buffer, keystrokes sync live. Open a session and share the code — no setup.',
  'live-present':
    'Present slides from your laptop while the audience follows on their phones. Slides sync at full quality through the session, no upload to a server.',
  'video-call':
    'A direct two-person video call between browsers. Media flows device to device, the session lives behind a six-character code and expires on its own.',
  'group-meeting':
    'Start a video meeting room in one click and let people in with a code or QR. Small groups, no accounts, nothing recorded, nothing stored.',
  'audio-call':
    'A voice-only call between browsers — lighter on battery and data than video. Open a session, share the code, talk.',
  'interview-room':
    'A video room set up for interviews: the candidate needs only the link. No accounts, no installs, the room disappears when the interview ends.',
  classroom:
    'A live room for teaching: students join with a six-character code, no sign-up. Talk, share your screen and keep everything inside the session.',
  'webinar-room':
    'Present to an audience without making anyone register. Viewers join with a code, watch live, and the room vanishes when you close it.',
  'screen-share':
    'Share a tab, a window or your whole screen from the browser. The viewer needs nothing but the session code. Nothing is recorded.',
  'remote-assist':
    'See what a friend or customer sees through their camera and guide them by voice. A view-only helper — no remote control of their device.',
  'co-browse':
    'Open a web page in a session and everyone sees the same page and scroll. Works with sites that allow embedding; logins stay on your side.',
  'guided-pointer':
    'Point at things on a shared screen together: your cursor and marks show up live for everyone in the session.',
  'support-session':
    'A guided support room: screen sharing and camera in one place, so you can walk someone through a fix step by step.',
  'walkie-talkie':
    'Push-to-talk between phones and laptops, like real walkie-talkies. Hold the button, talk, release. Lives in a temporary session.',
  'voice-record':
    'Record audio in the browser and others in the session hear it live. Download the recording before the session ends — nothing kept on servers.',
  'camera-live':
    'Stream your camera to another device live — show something, check a scene, help someone. The stream exists only inside the session.',
  'baby-monitor':
    'Turn two devices into a monitor: one watches, one listens. No cloud, no account. Keep the watching tab open and the device plugged in.',
  'temp-stream':
    'Go live for a short while — a quick demo, a moment, a view — and the stream disappears when the session ends.',
  'location-share':
    'Share your live position with people in the session, from your browser. Only session members see it; nothing is stored afterwards.',
  'live-captions':
    'Live captions for speech in the session, with translation built in. Runs in the browser; speech recognition support varies by browser.',
  'phone-webcam':
    'Use your phone camera as a webcam on your computer through the browser — no cables, no driver installs, nothing uploaded.',
  'phone-mic':
    'Use your phone as a microphone for your computer through the browser. Better sound, zero setup, nothing leaves the session.',
  'presentation-clicker':
    'Drive slides from your phone: next, previous and a live pointer for the audience. Pairs with Live Presentation through a session code.',
  'screen-to-phone':
    'See your computer screen on your phone in real time — read along from the couch or check the big screen from across the room.',
}

/** Per-tool FAQs: two per app, written to the questions people actually type. */
export const APP_FAQS: Record<string, Faq[]> = {
  beam: [
    {
      q: 'Does Beam work from a phone to a laptop?',
      a: 'Yes. Any mix of phones, tablets and computers. Open the same session on both devices with the QR code or the six-character code, and text moves the moment you send it.',
    },
    {
      q: 'Where is my text kept?',
      a: 'Only inside the live session. Nothing is written to a database; when the session ends or expires, the history is gone.',
    },
  ],
  drop: [
    {
      q: 'Are my files uploaded to a server?',
      a: 'No. Files travel through the live session directly between the devices in it, and they are discarded when the session ends. The 50 MB per-file limit exists because the transfer runs peer-to-peer.',
    },
    {
      q: 'What happens if the connection drops mid-transfer?',
      a: 'ShareOnWeb reconnects on its own, and failed files stay queued on your side so you can resend them with one tap once the link is back.',
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
      a: 'It puts two devices into the same live session instantly, so you can move to the real tool (files, text, camera) without typing a code on the second device.',
    },
    {
      q: 'Does it use Bluetooth?',
      a: 'No. Pairing runs over the web like everything else on ShareOnWeb: the second device joins through a link or QR, so it works across networks, not just in the same room.',
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
  'shared-docs': [
    {
      q: 'Can several people type at the same time?',
      a: 'Yes, it is one live document. Everyone in the session writes into the same note and sees the others as they type.',
    },
    {
      q: 'Is the note saved for later?',
      a: 'Nothing is stored on our side. Copy the note out (or keep the session alive) before you end it; ending the session discards the text.',
    },
  ],
  'code-editor': [
    {
      q: 'Do both people need to open the editor in the same session?',
      a: 'Yes. The editor is live pair-programming: one shared buffer, keystrokes from both sides as they happen.',
    },
    {
      q: 'Does it need any setup or extensions?',
      a: 'No. It opens in the browser like every tool here. Create a session, share the code, and you are editing together.',
    },
  ],
  'live-present': [
    {
      q: 'Can the audience follow on their phones?',
      a: 'That is the main setup: you present from your laptop, everyone else opens the session code on their phone and sees the current slide live.',
    },
    {
      q: 'Are my slides uploaded anywhere?',
      a: 'No. Slides travel through the live session at full quality and exist only on the devices in it.',
    },
  ],
  'video-call': [
    {
      q: 'How many people can a Private Call hold?',
      a: 'It is built for two devices; that is what keeps the media direct between browsers. For a group, use Group Meeting.',
    },
    {
      q: 'Is the video routed through a server?',
      a: 'The connection is set up through our relay, but the video and audio flow directly between the browsers whenever the networks allow it.',
    },
  ],
  'group-meeting': [
    {
      q: 'Do my guests need to install anything?',
      a: 'No. Everyone joins from a browser with the code, the link or the QR, on a phone or a computer.',
    },
    {
      q: 'Are meetings recorded?',
      a: 'No. There is no recording and no cloud storage; when the session ends, it is gone.',
    },
  ],
  'audio-call': [
    {
      q: 'Why choose a voice-only call?',
      a: 'It is much lighter on battery and mobile data than video, and it opens faster, which is good for a long talk on a weak connection.',
    },
    {
      q: 'Can I switch to video later?',
      a: 'Start a Private Call or Group Meeting when you need faces; both join the same way, with a code.',
    },
  ],
  'interview-room': [
    {
      q: 'What does the candidate need?',
      a: 'Just the link or code and a browser. No account, no download, no calendar magic, which is exactly what you want for a one-off interview.',
    },
    {
      q: 'What happens when the interview ends?',
      a: 'The room is a normal temporary session: end it and everything, video and chat included, is discarded.',
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
    {
      q: 'How long can a webinar run?',
      a: 'Sessions stay alive for 24 hours by default, and you can end one the moment you are done.',
    },
  ],
  'screen-share': [
    {
      q: 'Can I share just one tab instead of my whole screen?',
      a: 'Yes. Your browser’s picker offers tabs, windows and entire screens. Pick the narrowest thing that does the job; nothing leaves the session.',
    },
    {
      q: 'What does the viewer need?',
      a: 'A browser and the session code. They watch live on any device, including a phone.',
    },
  ],
  'remote-assist': [
    {
      q: 'Can the helper control the other device?',
      a: 'No, and that is deliberate. The helper sees the camera view (a screen, a cable, a router) and talks the person through the fix. Their device stays theirs.',
    },
    {
      q: 'How do I start helping someone?',
      a: 'Open Remote Assist, start a session, and send them the code. They point their camera at the problem; you see it live and guide them.',
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
  'guided-pointer': [
    {
      q: 'What does everyone else see when I point?',
      a: 'Your pointer and your marks render live on the shared screen for the whole session, which is useful for “look here” moments during a walkthrough.',
    },
    {
      q: 'Does it work on touch devices?',
      a: 'Yes: touch, pen and mouse all drive the pointer.',
    },
  ],
  'support-session': [
    {
      q: 'What is the difference from plain screen sharing?',
      a: 'A Support Session bundles the pieces a fix actually needs (screen sharing plus the camera) so you can show the setup and the screen in one room.',
    },
    {
      q: 'How does the other person join?',
      a: 'With the code, link or QR, straight in a browser. They need nothing installed and no account.',
    },
  ],
  'walkie-talkie': [
    {
      q: 'How does push-to-talk work?',
      a: 'Hold the button to talk, release to listen, on any device in the session. It behaves like real walkie-talkies, so nobody talks over anybody.',
    },
    {
      q: 'Does the tab need to stay open?',
      a: 'Yes, on every device in the session. It runs in the browser, so keep the tab in the foreground while you use it.',
    },
  ],
  'voice-record': [
    {
      q: 'Where do my recordings go?',
      a: 'They live inside the session and can be downloaded from it. Nothing is kept on our side once the session ends or expires.',
    },
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
    {
      q: 'Is the video stored anywhere?',
      a: 'No. The stream exists only between the devices in the session and disappears when it ends.',
    },
  ],
  'baby-monitor': [
    {
      q: 'How do I set it up as a monitor?',
      a: 'Leave one device (the watcher) pointed at the crib or bed with its tab open, and listen from the other device with the session code. No cloud account, no subscription.',
    },
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
    {
      q: 'Who can watch the stream?',
      a: 'Only the devices in the session, whoever you gave the code, link or QR to.',
    },
  ],
  'location-share': [
    {
      q: 'Who can see my location?',
      a: 'Only the devices in that session, and only while it runs. There is no history: when the session ends, the position is discarded.',
    },
    {
      q: 'Does it need the location permission?',
      a: 'Yes. Your browser will ask once, and you can decline; the rest of the session keeps working.',
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
  'phone-webcam': [
    {
      q: 'How does the phone become a webcam?',
      a: 'Open the session on your computer, join from the phone with the code, allow the camera, and the phone’s video appears on the computer as a webcam source.',
    },
    {
      q: 'Is there a cable or driver to install?',
      a: 'No. It works over the browser on both devices; nothing is installed and nothing is uploaded to a server.',
    },
  ],
  'phone-mic': [
    {
      q: 'Why use a phone as a microphone?',
      a: 'Phone mics are usually better than laptop mics, and this works even if the computer has no mic at all. The phone joins the session and its audio lands on the computer.',
    },
    {
      q: 'Is the audio uploaded anywhere?',
      a: 'No. It streams through the live session between your devices only.',
    },
  ],
  'presentation-clicker': [
    {
      q: 'Can I control slides from my phone?',
      a: 'Yes: next and previous, plus a live pointer for the audience. The phone joins the session with the code and drives the presentation.',
    },
    {
      q: 'Does it work with PowerPoint or Keynote?',
      a: 'It is built to drive Live Presentation and shared screens inside the session. For desktop apps, share your screen and use the pointer to walk through your deck.',
    },
  ],
  'screen-to-phone': [
    {
      q: 'Why mirror my computer to a phone?',
      a: 'Read a document from the couch, check the big screen from across the room, or follow a dashboard while you walk around: the phone sees the computer live.',
    },
    {
      q: 'Can I control the computer from the phone?',
      a: 'No. This is a viewer. Control stays on the computer, which keeps it safe to share the code inside your home or office.',
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
    a: 'It stays inside the live session. Text, files, boards and chats travel between the devices in the session and are discarded when the session ends or expires. Files sent with Drop and Folder Share never touch a cloud server.',
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
    keywords: [app.name.toLowerCase(), ...app.intents.slice(0, 10)],
  }
}
