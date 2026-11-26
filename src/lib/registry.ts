// The Kontivo tool catalog.
//
// IMPORTANT DESIGN PRINCIPLES:
// 1. Kontivo is a HUB of practical tools, organized around human
//    intentions — not around WebRTC capabilities. Nobody searches for a
//    DataChannel. They search for "send a file from my phone to my laptop
//    without uploading it." Every entry starts from that intention.
// 2. Related tools are SUBMERGED into one tool with modes (variants): Share is
//    one tool that sends text, files, folders and pairs devices — it is not
//    four separate apps — and inside a session every mode is reachable with
//    the same code. Each variant keeps its legacy session id for old rooms.
// 3. Every tool lives at its own real URL (/share, /call) and every session
//    at its own path (/K7T29Q). No query-param orphan links. Instant tools
//    (kind: 'instant') are whole tools on one page with no session at all.

export type AppCategory =
  | 'communicate'
  | 'share'
  | 'collaborate'
  | 'remote'
  | 'utilities'
  | 'instant'

export type AppStatus = 'live' | 'soon'

/** One mode of a tool. Sessions are created under the variant's id. */
export interface AppVariant {
  /** The session appId (the stable, legacy id) — e.g. 'drop'. */
  id: string
  /** Mode name shown in the tool's mode picker, e.g. "Files". */
  name: string
  /** One-liner written as the intention this mode serves. */
  tagline: string
  icon: string
  features: string[]
  howItWorks?: string[]
  deviceNote?: string
}

/**
 * 'session' tools open a live room with a code; 'instant' tools run entirely
 * on this device — no session, no code, files never leave the browser.
 */
export type AppKind = 'session' | 'instant'

export interface AppDef {
  id: string
  name: string
  category: AppCategory
  status: AppStatus
  /** Session tools open rooms; instant tools process locally. Default: 'session'. */
  kind?: AppKind
  /** One-liner written as the intention it serves. */
  tagline: string
  /** Longer explanation shown on the tool's landing page. */
  description: string
  /** Lucide icon key (mapped in components/platform/app-icon.tsx). */
  icon: string
  /** Phrases people would actually type or say. Used by Discover search. */
  intents: string[]
  features: string[]
  /** 3 steps for live tools. */
  howItWorks?: string[]
  /** What to expect, for coming-soon tools. */
  soonNote?: string
  /** Permissions / device requirements worth surfacing. */
  deviceNote?: string
  /** Live tools to suggest instead, for coming-soon tools. */
  relatedLive?: string[]
  /** Modes of this tool. Absent = the tool is its own single mode. */
  variants?: AppVariant[]
  /** Variant used by one-click starts that only name the tool. */
  defaultVariantId?: string
}

export interface CategoryDef {
  id: AppCategory
  label: string
  purpose: string
  icon: string
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'share', label: 'Transfer', purpose: 'Between your own devices, or to someone else', icon: 'transfer' },
  { id: 'communicate', label: 'Talk & Meet', purpose: 'Calls, meetings, classrooms', icon: 'video' },
  { id: 'collaborate', label: 'Create Together', purpose: 'Boards, notes, slides, decisions', icon: 'brush' },
  { id: 'remote', label: 'Remote & Support', purpose: 'Screens, assistance, browsing together', icon: 'help' },
  { id: 'utilities', label: 'Everyday Utilities', purpose: 'Cameras, microphones, location, captions', icon: 'radio' },
  { id: 'instant', label: 'Instant Tools', purpose: 'One device, done in seconds — files never leave your browser', icon: 'zap' },
]

export const APPS: AppDef[] = [
  // ------------------------------------------------------------------ share
  {
    id: 'share',
    name: 'Share',
    category: 'share',
    status: 'live',
    tagline: 'Send text, files and whole folders between your devices — no uploads, no cables.',
    description:
      'The everything-transfer tool: paste a link on your phone and it lands on your laptop; drag in photos and they arrive instantly; hand over a whole folder with its structure intact. One session does all of it — text, files and folders live side by side inside the same room, so you never juggle codes. Everything travels through the live session, directly between the devices in it, and is discarded when the session ends. One QR scan pairs two devices for all of it.',
    icon: 'transfer',
    intents: [
      'send photos from my phone to my laptop',
      'transfer files phone to pc',
      'send files without uploading',
      'airdrop alternative',
      'send text to my computer',
      'copy from phone to pc',
      'share a link between devices',
      'clipboard sharing',
      'share a folder between devices',
      'transfer a whole folder',
      'send many files at once',
      'pair devices with qr code',
      'move files without a cable',
      'send a wifi password to a guest',
    ],
    features: [
      'Text, files and folders inside one session — one code does everything',
      'Phone to computer, computer to phone, or any mix of devices',
      'Up to 50 MB per file, no compression, no re-encoding',
      'Folder structure preserved, download everything back as one ZIP',
      'Scan one QR and the devices stay paired for the whole session',
      'Live progress for every transfer',
      'Content vanishes when the session ends',
    ],
    howItWorks: [
      'Pick what you are sending, or start with Quick Pair to do everything',
      'Open the same session on the other device: scan the QR code or type the 6-character code',
      'Send. It is already there.',
    ],
    deviceNote:
      'Keep the tab open on both devices while a transfer runs. If the connection dips, Kontivo reconnects and you can resend anything.',
    variants: [
      {
        id: 'beam',
        name: 'Text',
        icon: 'zap',
        tagline: 'Send text and links from one device to another, instantly.',
        features: [
          'Text appears instantly on every device in the session',
          'Paste straight from your clipboard with one tap',
          'One-tap copy on the receiving device',
          'History exists only while the session lives',
        ],
        howItWorks: [
          'Create a session on the device that has the text',
          'Open it on the other device with the QR code or the 6-character code',
          'Send. It is already there.',
        ],
        deviceNote:
          'The Paste button uses your browser clipboard only when you tap it. Your browser will ask for permission first.',
      },
      {
        id: 'drop',
        name: 'Files',
        icon: 'transfer',
        tagline: 'Move files between your phone and your computer without uploading them anywhere.',
        features: [
          'Drag in photos, documents, recordings — up to 50 MB per file',
          'No compression, no re-encoding: files arrive exactly as sent',
          'Live progress for sending and receiving',
          'Image previews before you download',
          'Files vanish when the session ends',
        ],
        howItWorks: [
          'Create a session; start it on either device',
          'Open it on the other device with the QR code or the 6-character code',
          'Drag files in. They transfer immediately with live progress.',
        ],
      },
      {
        id: 'folder-share',
        name: 'Folder',
        icon: 'folder',
        tagline: 'Hand over an entire folder, not one file at a time.',
        features: [
          'Folder structure preserved, nested subfolders included',
          'Drop a folder straight from your desktop, or pick it with a button',
          'Download everything back as one ZIP with the structure rebuilt',
          'Live progress per file, grouped by folder',
          'Same privacy model: nothing stored after the session',
        ],
        howItWorks: [
          'Create a session on the device that has the folder',
          'Open it on the other device with the QR code or the 6-character code',
          'Drop the folder in. Every device receives it, structure and all.',
        ],
        deviceNote:
          'Files come across exactly as sent, up to 50 MB each. Keep both tabs open until every transfer finishes, then rebuild the folder with “Download all”.',
      },
      {
        id: 'quick-pair',
        name: 'Quick Pair',
        icon: 'qr',
        tagline: 'Pair two devices with a QR code and share anything between them.',
        features: [
          'Scan-to-pair in one step',
          'One surface for text and files once paired',
          'Unpair instantly or let the session expire',
        ],
        howItWorks: [
          'Open Quick Pair here and scan the QR with your other device',
          'The devices pair instantly, with no codes to type',
          'Send text and files back and forth from one surface',
        ],
      },
    ],
    defaultVariantId: 'drop',
  },

  // ------------------------------------------------------------- communicate
  {
    id: 'call',
    name: 'Call',
    category: 'communicate',
    status: 'live',
    tagline: 'Video and voice rooms that open in one click and vanish when you are done.',
    description:
      'One room, every shape a conversation takes: a two-person video call, a team meeting, an audio-only talk on a weak network, an interview with a private notes pane, a classroom with raised hands, a webinar with muted viewers. Everyone joins from a browser with a link, a QR or a six-character code. Media flows device to device; nothing is recorded, and the room disappears when you close it.',
    icon: 'video',
    intents: [
      'private video call',
      'video call without app',
      'group video meeting',
      'team video call',
      'audio only call',
      'voice call online',
      'interview room online',
      'candidate video interview',
      'online classroom',
      'teach online live',
      'webinar room',
      'present to many people',
      'temporary meeting room',
    ],
    features: [
      'One click from link, QR or code — no accounts for anyone',
      'Peer-to-peer video and audio whenever the networks allow',
      'Audio-only mode that is gentle on battery and data',
      'Hand-raise, spotlight and reactions for groups',
      'Presenter/viewer and teacher/student roles',
      'Private notes for interviews, chat in every room',
      'Rooms expire on their own; nothing is recorded',
    ],
    howItWorks: [
      'Pick the shape of the conversation and start the room',
      'Share the link, QR or six-character code',
      'Talk. End it when you are done — the room then ceases to exist.',
    ],
    deviceNote:
      'Asks for camera and microphone permission before starting, with a pre-call device check. You can join with both off and enable them later.',
    variants: [
      {
        id: 'video-call',
        name: 'Video Call',
        icon: 'video',
        tagline: 'Talk face to face with one person, straight from the browser.',
        features: [
          'A one-to-one call with a shareable link',
          'Peer-to-peer video when possible',
          'Simple mute and camera controls',
          'Link expires with the session',
        ],
        howItWorks: [
          'Start the call and allow camera + microphone',
          'Share the link, and the other person clicks to join',
          'Talk face to face; end the call any time',
        ],
      },
      {
        id: 'group-meeting',
        name: 'Group Meeting',
        icon: 'users',
        tagline: 'Get the whole team into one video room in seconds.',
        features: [
          'Small-group video with screen sharing built in',
          'Temporary rooms, nothing persists',
          'Join by link, QR or code',
        ],
        howItWorks: [
          'Start the meeting room',
          'Invite the team by link, QR or code',
          'Talk, share screens and react; the room vanishes when done',
        ],
      },
      {
        id: 'audio-call',
        name: 'Voice Only',
        icon: 'phone',
        tagline: 'Audio-only calls when video is not needed, light and instant.',
        features: [
          'A fraction of the data of a video call',
          'Great on weak mobile networks',
          'Same one-click join model',
        ],
        howItWorks: [
          'Start the voice call',
          'Share the code or link',
          'Talk as long as you like: audio only, easy on data',
        ],
      },
      {
        id: 'interview-room',
        name: 'Interview Room',
        icon: 'briefcase',
        tagline: 'A quiet, temporary room for interviews with a shareable link.',
        features: [
          'Candidate joins with one click, no account',
          'Private notes pane for the interviewer',
          'Room expires automatically',
        ],
        howItWorks: [
          'Open the room and start your camera',
          'Send the candidate the link (one click, no account)',
          'Take private notes on your side; the room self-destructs',
        ],
      },
      {
        id: 'classroom',
        name: 'Classroom',
        icon: 'school',
        tagline: 'Teach a class live, with hands raised and shared material.',
        features: [
          'Student hand-raise queue',
          'Teacher-controlled sharing and spotlight',
          'Join by 6-character class code, no sign-up',
        ],
        howItWorks: [
          'Open the classroom; as the starter, you are the teacher',
          'Students join with the class code',
          'They raise hands and react; you spotlight who is on stage',
        ],
      },
      {
        id: 'webinar-room',
        name: 'Webinar Room',
        icon: 'presentation',
        tagline: 'Present to many, with viewers muted by default.',
        features: [
          'Presenter controls',
          'Viewers join as read-only',
          'Built-in polls, Q&A and reactions',
        ],
        howItWorks: [
          'Start the webinar; you are the presenter',
          'Viewers join muted by link or code',
          'They chat, react and raise hands while you present',
        ],
      },
    ],
    defaultVariantId: 'video-call',
  },

  // ------------------------------------------------------------------ remote
  {
    id: 'screen',
    name: 'Screen',
    category: 'remote',
    status: 'live',
    tagline: 'Show your screen to anyone — or see theirs — straight from the browser.',
    description:
      'Every screen-to-screen moment in one tool: share a tab, a window or a whole screen with someone; keep your PC screen in your pocket on your phone; walk a parent through a fix by seeing their camera; annotate live so “click there” finally means something; run a structured support session with steps and notes. Video travels browser-to-browser: no server in the middle, nothing recorded, and the share dies with the session.',
    icon: 'monitor',
    intents: [
      'screen sharing session',
      'show my screen',
      'share my screen with someone',
      'present my screen live',
      'share pc screen with phone',
      'see my computer screen on my phone',
      'remote assistance',
      'help someone fix their computer remotely',
      'remote support for parents',
      'annotate someone\'s screen',
      'point at remote screen',
      'customer support screen share',
      'it helpdesk session',
    ],
    features: [
      'Share a whole screen, a single window or one browser tab',
      'Video streams directly between devices, peer to peer',
      'Watch your computer on your phone, one-way and live',
      'Guide someone through their camera view — view-only, no control',
      'Laser pointer and annotations on the shared view',
      'Structured support rooms with consent and step notes',
      'Optional system audio comes through too',
    ],
    howItWorks: [
      'Pick the direction: share mine, see theirs, or watch on my phone',
      'Connect the devices with the QR code or the 6-character code',
      'The screen appears live everywhere; stop with one tap',
    ],
    deviceNote:
      'Your browser\'s share picker decides what is shared, and nothing streams before you pick. Some strict corporate networks block direct video; if so the connection status says so instead of failing silently.',
    variants: [
      {
        id: 'screen-share',
        name: 'Share My Screen',
        icon: 'monitor',
        tagline: 'Show your screen to someone, live and straight from the browser.',
        features: [
          'Share a whole screen, a single window or one browser tab',
          'Video streams directly between devices, peer to peer',
          'Others watch in one click, fullscreen built in',
          'Stop with one tap, from here or from your browser bar',
          'Optional system audio comes through too',
        ],
        howItWorks: [
          'Create a session on the device doing the sharing',
          'On the other device, scan the QR or type the 6-character code',
          'Press “Share my screen” and pick a surface; it appears live everywhere',
        ],
      },
      {
        id: 'screen-to-phone',
        name: 'Screen on Phone',
        icon: 'monitorsmartphone',
        tagline: 'See your computer screen on your phone, as a second glance.',
        features: [
          'One-way screen view on the phone',
          'Auto-refreshing, low data',
          'Ends with the session',
        ],
        howItWorks: [
          'Start sharing your screen here',
          'Open the code on your phone',
          'Keep a live glance at your computer in your pocket',
        ],
      },
      {
        id: 'remote-assist',
        name: 'Remote Assist',
        icon: 'help',
        tagline: 'Help someone by seeing their screen and guiding them.',
        features: [
          'They click one link; no install, no account',
          'You guide; they stay in control',
          'View-only: their device stays theirs',
        ],
        howItWorks: [
          'The person needing help joins with the code',
          'They pick “I need help” and approve your view request',
          'You see their screen and talk them through the fix',
        ],
      },
      {
        id: 'guided-pointer',
        name: 'Pointer & Markup',
        icon: 'pointer',
        tagline: 'Point at and annotate what is on someone else\'s screen.',
        features: [
          'Laser pointer on the shared view',
          'Annotations fade or persist',
          'Only the helper can mark up',
        ],
        howItWorks: [
          'Join as the helper and request to view their screen',
          'They approve, and their screen appears here',
          'Point and annotate live so “click there” finally means something',
        ],
      },
      {
        id: 'support-session',
        name: 'Support Session',
        icon: 'lifesaver',
        tagline: 'Structured remote technical support with join codes.',
        features: [
          'Session transcript of steps taken',
          'Consent prompt before viewing',
          'Ends cleanly, expires automatically',
        ],
        howItWorks: [
          'Open the session and the customer joins by code',
          'Request view access and list the fix steps',
          'Work through the steps; the session logs itself until it expires',
        ],
      },
    ],
    defaultVariantId: 'screen-share',
  },

  // --------------------------------------------------------------- utilities
  {
    id: 'camera',
    name: 'Camera',
    category: 'utilities',
    status: 'live',
    tagline: 'Put a live camera wherever you need one, from the devices you already own.',
    description:
      'Your phones and laptops already are cameras — this tool aims them: stream what your camera sees to another device, use your phone as a wireless webcam for your computer, turn two devices into a consent-first baby or pet monitor, or go live for a short while and let the stream disappear. Feeds run device to device and end with the session; nothing is stored by default.',
    icon: 'camera',
    intents: [
      'live camera sharing',
      'show my camera live',
      'share what i see',
      'use phone as webcam',
      'phone camera for pc',
      'wireless webcam',
      'baby monitor online',
      'pet camera',
      'monitor a room from another device',
      'temporary live streaming',
      'small live stream',
      'stream an event to friends',
    ],
    features: [
      'Watch from any device with the code, link or QR',
      'Phone camera as a wireless webcam for your computer',
      'Consent-first monitoring with loud disconnect alerts',
      'Viewer snapshots where it helps',
      'Streams end with the session; nothing archived',
    ],
    howItWorks: [
      'Pick the job: live camera, webcam, monitor or stream',
      'Open the session on the camera device and allow the camera',
      'Everyone else watches live with the code or QR',
    ],
    deviceNote:
      'Asks for camera permission on the device sharing its lens. Some phones pause video when the screen locks — keep the camera device plugged in and the tab open.',
    variants: [
      {
        id: 'camera-live',
        name: 'Live Camera',
        icon: 'camera',
        tagline: 'Share what your camera sees, live, with a link.',
        features: [
          'Point your camera at something and let others watch through the session',
          'Watch from any device with the code',
          'Snapshot button for viewers',
          'Stream ends with the session',
        ],
        howItWorks: [
          'Start sharing your camera',
          'Others open the code on any device to watch live',
          'Viewers can take snapshots; the stream ends with the session',
        ],
        deviceNote: 'Asks for camera permission first; nothing is recorded by default.',
      },
      {
        id: 'phone-webcam',
        name: 'Phone as Webcam',
        icon: 'webcam',
        tagline: 'Use your phone\'s camera as a wireless webcam for your computer.',
        features: [
          'Your phone becomes the camera your computer uses',
          'Front or back camera switch',
          'Battery-friendly streaming, zero cables',
        ],
        howItWorks: [
          'Open this session on your phone and allow the camera',
          'Your phone’s video appears on the computer',
          'Front or back lens, your call',
        ],
        deviceNote: 'Asks for camera permission on the phone only.',
      },
      {
        id: 'baby-monitor',
        name: 'Baby & Pet Monitor',
        icon: 'baby',
        tagline: 'Keep an eye on things with secure, consent-first monitoring.',
        features: [
          'One device watches, another listens in',
          'Explicit consent on the camera device',
          'Loud alerts when the connection drops',
          'Always expires, never a permanent feed',
        ],
        howItWorks: [
          'On the watching device: open the session',
          'On the camera device: tick consent and start',
          'If the feed ever drops, the watching device alerts loudly',
        ],
      },
      {
        id: 'temp-stream',
        name: 'Live Stream',
        icon: 'tower',
        tagline: 'Stream live for a short while, then it is gone.',
        features: [
          'Camera and mic broadcast to every viewer',
          'Viewer link that expires',
          'No VOD, no archive',
        ],
        howItWorks: [
          'Go live, and your camera and mic broadcast to every viewer',
          'Share the viewer link or code',
          'Stop when done; nothing is archived or replayed',
        ],
      },
    ],
    defaultVariantId: 'camera-live',
  },

  {
    id: 'voice',
    name: 'Voice',
    category: 'utilities',
    status: 'live',
    tagline: 'Push-to-talk, wireless microphones and recorders — from the devices in your pocket.',
    description:
      'Audio, shaped for the moment: hold a button and talk like a real walkie-talkie, turn your phone into a proper microphone for your computer, or record while everyone in the session listens live and grab the file at the end. Everything streams through the session and disappears when it ends.',
    icon: 'radio',
    intents: [
      'browser walkie talkie',
      'push to talk online',
      'voice chat for a group nearby',
      'use phone as microphone',
      'phone mic for pc',
      'wireless microphone',
      'voice recorder with live sharing',
      'record audio and share',
      'live voice memo',
    ],
    features: [
      'Push-to-talk, no accidental open mics',
      'Phone mic for your computer across the room',
      'Record while streaming to listeners live',
      'Downloadable recording at the end',
      'Session-scoped: audio is gone when the session ends',
    ],
    howItWorks: [
      'Pick the mode: talk, mic or record',
      'Join from the devices and allow the microphone',
      'Hold to talk, or hit record — everyone hears it live',
    ],
    deviceNote: 'Asks for microphone permission before any mode starts, with a pre-talk check.',
    variants: [
      {
        id: 'walkie-talkie',
        name: 'Walkie-Talkie',
        icon: 'radio',
        tagline: 'Push-to-talk voice across devices, like a real walkie-talkie.',
        features: [
          'Hold the button (or the Space bar) and talk',
          'Push-to-talk, no accidental open mics',
          'Works phone to phone to PC',
          'Instant join by code',
        ],
        howItWorks: [
          'Everyone joins with the code',
          'Hold the big button and talk',
          'Release and someone else takes a turn',
        ],
      },
      {
        id: 'phone-mic',
        name: 'Phone as Microphone',
        icon: 'audiolines',
        tagline: 'Turn your phone into a wireless microphone for your PC.',
        features: [
          'Low-latency audio to your computer',
          'Better sound than most laptop mics',
          'Input level meter',
        ],
        howItWorks: [
          'Open this session on your phone and allow the microphone',
          'Your phone’s audio plays on the computer',
          'The level meter confirms the signal',
        ],
        deviceNote: 'Asks for microphone permission on the phone only.',
      },
      {
        id: 'voice-record',
        name: 'Voice Recorder',
        icon: 'mic',
        tagline: 'Record audio and share it live as you speak.',
        features: [
          'Records while streaming to listeners',
          'Downloadable copy at the end',
          'Session-scoped, then gone',
        ],
        howItWorks: [
          'Start recording and everyone in the session hears you live',
          'Speak; the level meter confirms you are heard',
          'Stop and the audio downloads. Then it is gone.',
        ],
      },
    ],
    defaultVariantId: 'walkie-talkie',
  },

  // ------------------------------------------------------------- collaborate
  {
    id: 'notepad',
    name: 'Notepad',
    category: 'collaborate',
    status: 'live',
    tagline: 'Write the same thing together, live — prose or code.',
    description:
      'One shared buffer on every device: meeting notes, a packing list, a draft you are shaping together — or a code snippet you are pair-programming, with syntax highlighting and snapshots. Everything you type appears for the others within a moment, and the whole thing disappears when the session ends.',
    icon: 'doc',
    intents: [
      'shared document editing',
      'collaborative notes',
      'write together online',
      'collaborative code editor',
      'pair programming online',
      'share code snippet live',
    ],
    features: [
      'Live sync: edits appear on every device as you pause',
      'Word, character and line counts as you write',
      'Code mode with syntax-aware editing and snapshots',
      'Copy or download the note as a .txt any time',
      'Safe merges when two people type at once',
      'Notes expire with the session, nothing stored',
    ],
    howItWorks: [
      'Pick prose or code, and start the note',
      'Everyone opens it with the code or QR and types',
      'Copy or download the result before the session expires',
    ],
    deviceNote: 'Works with any keyboard or touch screen. No account, no install.',
    variants: [
      {
        id: 'shared-docs',
        name: 'Shared Note',
        icon: 'doc',
        tagline: 'Write the same note together, live.',
        features: [
          'Live sync, so edits appear on every device as you pause',
          'Word, character and line counts as you write',
          'Copy or download the note as a .txt any time',
          'Safe merges when two people type at once',
          'Notes expire with the session, nothing stored',
        ],
        howItWorks: [
          'Start a note and share the code or QR',
          'Everyone opens it and types; it autosaves as you pause',
          'Copy or download the note before the session expires',
        ],
      },
      {
        id: 'code-editor',
        name: 'Code Editor',
        icon: 'code',
        tagline: 'Edit the same code with someone, with zero setup.',
        features: [
          'Syntax-aware editing with language highlighting',
          'Follow-my-cursor mode',
          'Snapshots let you restore any earlier version',
          'Snippet history for the session',
        ],
        howItWorks: [
          'Paste or type your code, and it syncs as you edit',
          'Share the code and pick the language for highlighting',
          'Snapshots let you restore any earlier version',
        ],
      },
    ],
    defaultVariantId: 'shared-docs',
  },

  {
    id: 'present',
    name: 'Present',
    category: 'collaborate',
    status: 'live',
    tagline: 'Present slides to any device — and drive the deck from your phone.',
    description:
      'The full presenting loop: load slides on your laptop, the audience follows on their phones at full quality, reactions roll in live — and your phone doubles as the clicker with next, back and a laser pointer. Slides travel through the session, not through an upload form.',
    icon: 'slides',
    intents: [
      'live presentations',
      'present slides online',
      'follow along presentation',
      'phone as remote presentation controller',
      'clicker for slides',
      'control slides from phone',
    ],
    features: [
      'Everyone stays on the presenter\'s slide, full quality',
      'Lightweight reactions from the audience',
      'Next / back / blank and a pointer from your phone',
      'Slide preview on the remote',
      'Works straight from the browser, no upload',
    ],
    howItWorks: [
      'Add slides on the presenting device; the audience follows your page automatically',
      'Share the code with the audience — their phones become viewers',
      'Join the same code on your phone to drive the deck as the remote',
    ],
    variants: [
      {
        id: 'live-present',
        name: 'Live Presentation',
        icon: 'slides',
        tagline: 'Present slides while everyone watches and reacts in real time.',
        features: [
          'Everyone stays on the presenter\'s slide',
          'Lightweight reactions',
          'Works straight from the browser',
        ],
        howItWorks: [
          'Add slides as images, and everyone follows your page automatically',
          'Share the code with your audience',
          'They watch and react while you keep the pointer and the pace',
        ],
      },
      {
        id: 'presentation-clicker',
        name: 'Phone Remote',
        icon: 'smartphone',
        tagline: 'Use your phone to control the slides on your computer.',
        features: [
          'Next / back / blank from the phone',
          'Slide preview on the phone',
          'Pairs by code in one tap',
        ],
        howItWorks: [
          'On the computer: open the session as the stage and load slides',
          'On the phone: join the same code and it becomes the remote',
          'Tap next / back / blank while the projector does the rest',
        ],
      },
    ],
    defaultVariantId: 'live-present',
  },

  {
    id: 'canvas',
    name: 'Canvas',
    category: 'collaborate',
    status: 'live',
    tagline: 'Draw together on the same whiteboard, from any device.',
    description:
      'A shared canvas that syncs strokes as you draw: sketch an idea during a call, explain a shape to a colleague, or doodle with a kid across town. Touch, stylus and mouse all work.',
    icon: 'brush',
    intents: [
      'draw together online',
      'shared whiteboard',
      'collaborative drawing',
      'whiteboard for kids',
      'sketch together',
      'online canvas with friends',
      'multiplayer drawing board',
    ],
    features: [
      'Strokes appear live on every screen as you draw',
      'Six colors, adjustable brush size, eraser',
      'Works with finger, stylus, trackpad or mouse',
      'Undo and clear are synced for everyone',
      'Export the board as a PNG',
    ],
    howItWorks: [
      'Create a board',
      'Share the code or QR with everyone who should draw',
      'Start sketching and everyone sees every stroke live',
    ],
  },

  {
    id: 'roundtable',
    name: 'Roundtable',
    category: 'collaborate',
    status: 'live',
    tagline: 'A live room for quick discussion and instant polls.',
    description:
      'Spin up a lightweight room for a quick huddle: chat that appears in real time and one-click polls with live results. No accounts for anyone, no setup.',
    icon: 'chat',
    intents: [
      'quick poll',
      'live chat room',
      'vote in a meeting',
      'team huddle',
      'discussion room',
      'poll students',
      'group chat without an account',
      'real-time polls',
    ],
    features: [
      'Live chat between everyone in the room',
      'Instant polls with live result bars',
      'See who is in the room and on which device',
      'Change your vote any time before the room ends',
      'Everything disappears when the session expires',
    ],
    howItWorks: [
      'Open a Roundtable room',
      'Share the link or code with the group',
      'Talk, vote, decide, then let it expire',
    ],
  },

  {
    id: 'co-browse',
    name: 'Collaborative Browsing',
    category: 'remote',
    status: 'live',
    tagline: 'Browse the same page together and point at things.',
    description:
      'Open a page together, with synced scrolling, a shared pointer, and markers everyone can see.',
    icon: 'pointer-click',
    intents: [
      'collaborative browsing',
      'browse together online',
      'show someone a website',
    ],
    features: [
      'Synced page and scroll position',
      'Shared cursor',
      'One-click link sharing',
    ],
    howItWorks: [
      'Paste the page you want to visit together',
      'Everyone follows in one click',
      'Turn on pointer mode to show each other what matters',
    ],
  },

  {
    id: 'location-share',
    name: 'Live Location',
    category: 'utilities',
    status: 'live',
    tagline: 'Share where you are for a limited time, only if you choose to.',
    description:
      'Opt-in location sharing that always has an end time, for meetups and "almost there" moments.',
    icon: 'mappin',
    intents: [
      'live location sharing',
      'share my location temporarily',
      'opt-in location',
    ],
    features: [
      'Always time-limited, with a visible countdown',
      'You choose who sees it',
      'One tap to stop',
      'Every live position plotted on one map',
    ],
    howItWorks: [
      'Pick how long to share, then tap the button',
      'Others see where you are, with a visible countdown',
      'Stop instantly, or let it expire on its own',
    ],
  },

  {
    id: 'live-captions',
    name: 'Live Captions & Translation',
    category: 'utilities',
    status: 'live',
    tagline: 'Real-time captions and translation for any conversation.',
    description:
      'Speak in one language and everyone reads captions in theirs, for classes, calls and cross-language chats.',
    icon: 'captions',
    intents: [
      'real time translation',
      'live captions',
      'translate a conversation live',
    ],
    features: [
      'Live captions in the room',
      'Per-viewer language choice',
      'Works with any live tool later',
    ],
    howItWorks: [
      'Start listening; captions appear in the shared feed',
      'Everyone reads along, live',
      'Turn on translation to read the room in your language',
    ],
  },

  // ------------------------------------------------------------ instant tools
  // kind: 'instant' — no session, no code, no pairing. Everything runs on
  // this device with Canvas/WebCrypto/JSZip; files never leave the browser.
  {
    id: 'zip',
    name: 'Zip & Unzip',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Pack a folder into a ZIP, or unpack any archive — right here in the browser.',
    description:
      'Turn a pile of files or a whole folder into one ZIP, or open a ZIP you received and pull everything out, structure intact. Nothing is uploaded: the archive is built and read on this device, so a 500 MB folder takes seconds and stays private.',
    icon: 'folder',
    intents: [
      'zip files online',
      'unzip online free',
      'compress folder into zip',
      'extract zip without software',
      'open archive in browser',
      'download all attachments as zip',
    ],
    features: [
      'Pack any number of files, or a whole folder with its structure',
      'Unpack ZIPs and see every entry before extracting',
      'Download one entry or everything at once',
      'Runs entirely on this device — nothing is uploaded',
      'No size walls: the only limit is this device\u2019s memory',
    ],
    howItWorks: [
      'Drop files or a folder in — or drop a ZIP to unpack',
      'Review the list, rename the archive if you like',
      'Download the ZIP, or extract the contents',
    ],
  },
  {
    id: 'image',
    name: 'Image Toolkit',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Compress, convert, resize, crop, rotate and flip images — batch, local, instant.',
    description:
      'One image workbench: shrink photos to a target size or quality, convert between PNG, JPEG and WebP, resize whole batches, crop boxes down to the pixel, and rotate or mirror quarter-turn clean. Every pixel is processed on this device with the browser\u2019s own encoder — your photos are never uploaded to anyone.',
    icon: 'image',
    intents: [
      'compress image online',
      'convert png to jpg',
      'convert to webp',
      'resize image online',
      'crop image online',
      'rotate image online',
      'flip mirror image',
      'reduce photo file size',
      'batch image converter',
      'make image smaller kb',
    ],
    features: [
      'Compress with a quality slider or aim at an exact target size',
      'Convert between PNG, JPEG and WebP, in batches',
      'Resize by pixels or percentage with aspect-ratio lock',
      'Crop with absolute pixel boxes, clamped per image so a batch setting always lands',
      'Rotate in quarter turns (no resampling) and mirror horizontally or vertically',
      'Before/after preview with the real file-size saving',
      'Everything processed locally — no uploads, ever',
    ],
    howItWorks: [
      'Drop one or many images in',
      'Pick a mode — compress, convert, resize, crop, rotate or flip — and set the options',
      'Download results one by one or all at once',
    ],
  },
  {
    id: 'hash',
    name: 'Hash & Verify',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'MD5 and SHA checksums for any file or text — verify a download in seconds.',
    description:
      'Drop a file or paste text and get its MD5, SHA-1, SHA-256 or SHA-512 checksum instantly, then compare it against the hash the publisher published to prove the download is intact and untampered. Hashing runs on this device; the file never leaves it.',
    icon: 'fingerprint',
    intents: [
      'md5 checksum online',
      'sha256 file hash',
      'verify download checksum',
      'file hash generator',
      'check iso hash',
      'text hash online',
    ],
    features: [
      'MD5, SHA-1, SHA-256 and SHA-512 in one pass',
      'Works for files of any type and for plain text',
      'Verify mode: paste the expected hash and get a clear match / no-match',
      'Huge files stream in chunks — no freeze, no upload',
      'Computed locally; nothing is sent anywhere',
    ],
    howItWorks: [
      'Drop the file, or switch to Text and paste',
      'All four checksums appear instantly',
      'Paste the expected hash to verify the match',
    ],
  },
  {
    id: 'encode',
    name: 'Base64 Encode & Decode',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Turn text or files into Base64 and back — data URLs included.',
    description:
      'Encode text to Base64 or decode it back, with full Unicode support, and turn any file into a data URL you can paste into HTML, CSS or JSON. Decoding a Base64 file back to a download works too. All of it happens on this device.',
    icon: 'braces',
    intents: [
      'base64 encode online',
      'base64 decode online',
      'text to base64',
      'base64 to file',
      'data url generator',
      'file to base64',
    ],
    features: [
      'Text \u2192 Base64 and Base64 \u2192 text, Unicode-safe',
      'File \u2192 Base64 / data URL for HTML, CSS and JSON',
      'Decode a Base64 file back into a downloadable file',
      'Swap direction in one click; copy results instantly',
      'No server involved — private by construction',
    ],
    howItWorks: [
      'Paste text or drop a file',
      'Pick the direction: encode or decode',
      'Copy the result or download it as a file',
    ],
  },
  {
    id: 'json',
    name: 'JSON Formatter',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Format, validate and minify JSON — with the exact error position.',
    description:
      'Paste JSON and get it pretty-printed, minified or verified. Broken JSON is not just \u201cinvalid\u201d: the formatter points at the exact line and column and shows the parser\u2019s message, so a stray comma takes seconds to find. Nothing is sent anywhere.',
    icon: 'braces',
    intents: [
      'json formatter online',
      'json validator',
      'pretty print json',
      'minify json',
      'fix json error',
      'json beautifier',
    ],
    features: [
      'Pretty-print with 2 or 4 space indent, or minify',
      'Validate with exact line and column of the error',
      'Sort keys alphabetically for diffing and comparing',
      'Live stats: size before and after, key count, depth',
      'Runs locally — paste API responses without worry',
    ],
    howItWorks: [
      'Paste or drop JSON',
      'Pick format, minify or validate',
      'Copy the result; errors point at the exact spot',
    ],
  },
  {
    id: 'text',
    name: 'Text Kit',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Count words, switch case, sort and clean lines — one quick page.',
    description:
      'The everyday text workbench: live word, character, sentence and reading-time counts; upper/lower/Title/camel/snake/kebab case conversion; and one-click line cleanup — sort, dedupe, trim, reverse, number. Paste, transform, copy. Nothing leaves the page.',
    icon: 'type',
    intents: [
      'word counter',
      'character counter',
      'case converter online',
      'remove duplicate lines',
      'sort lines alphabetically',
      'reading time calculator',
    ],
    features: [
      'Live counts: words, characters, sentences, paragraphs, reading time',
      'Case tools: UPPER, lower, Title, Sentence, camel, snake, kebab',
      'Line ops: sort, dedupe, trim, remove empties, reverse, number',
      'Find and replace with plain or regex patterns',
      'All transformations preview live and copy in one tap',
    ],
    howItWorks: [
      'Paste or type your text',
      'Pick a transform — the result updates live',
      'Copy it back out with one click',
    ],
  },
  {
    id: 'password',
    name: 'Password Generator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Strong passwords and passphrases from real browser randomness.',
    description:
      'Generate passwords and passphrases with the browser\u2019s cryptographic random source \u2014 length, symbols, digits and ambiguity exclusions under your control, a live strength estimate, and a memorable word-based mode when you need to type it on a TV remote. Generated on this device, never transmitted, never stored.',
    icon: 'key',
    intents: [
      'password generator',
      'strong password online',
      'random passphrase',
      'memorable password generator',
      'secure random password',
    ],
    features: [
      'Cryptographic randomness from the browser, not Math.random',
      'Length, digits, symbols and look-alike exclusion toggles',
      'Passphrase mode: memorable words with separators and numbering',
      'Live strength estimate with entropy explained',
      'Bulk-generate a list; copy any of them with one tap',
    ],
    howItWorks: [
      'Set the length and character mix',
      'Generate \u2014 every password is freshly random',
      'Copy it straight into your password manager',
    ],
  },
  {
    id: 'qr',
    name: 'QR Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'QR codes for links, Wi\u2011Fi, contact cards and UPI payments \u2014 with center logos, contrast checks and batch ZIP export, all on-device.',
    description:
      'The studio takes QR codes from gimmick to production: payloads for links, plain text, Wi\u2011Fi join codes (with full spec escaping), vCard 3.0 contact cards and UPI payment intents (GPay, PhonePe, Paytm and bank apps). Design controls: foreground and background colors with a live contrast warning, quiet-zone width, size up to 2048 px and error-correction L\u2013H with honest guidance for center logos. The raw encoded payload is always shown so you can verify before printing. Batch mode renders one code per line into a downloadable ZIP. Everything renders locally with a scan tab to verify real-world codes.',
    icon: 'qr',
    intents: [
      'qr code generator',
      'upi qr code generator',
      'wifi qr code',
      'qr code with logo',
      'vcard qr code',
      'batch qr code generator',
      'create qr for link',
      'free qr code download png',
    ],
    features: [
      'Five payload types: link, text, Wi\u2011Fi, vCard 3.0 and UPI payments',
      'Center logo embedding with error-correction guidance (Q/H recommended)',
      'Contrast checker that warns before you print an unscannable code',
      'Quiet-zone, size (128\u20132048 px) and error-correction L/M/Q/H control',
      'Batch mode: one payload per line becomes a ZIP of named PNGs',
      'The raw payload string is always visible \u2014 verify before you print',
    ],
    howItWorks: [
      'Pick a payload type and fill in the details \u2014 the code renders as you type',
      'Tune colors, size, quiet zone and error correction; add a logo if you like',
      'Verify the raw payload, then download a PNG or a whole batch ZIP',
    ],
  },
  {
    id: 'pdf',
    name: 'PDF Toolkit',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Merge, organize, rotate and split PDFs \u2014 with a visible page for every move.',
    description:
      'Drop one PDF and rearrange it page by page with live thumbnails \u2014 reorder, rotate, delete. Drop two or more and they merge in your chosen order. Splitting is precise: extract ranges like 1-3, 7 or cut the file every N pages and take the parts as a ZIP. All of the surgery happens on this device with pdf-lib; nothing is uploaded.',
    icon: 'file-stack',
    intents: [
      'merge pdf files online',
      'split pdf online free',
      'reorder pdf pages',
      'rotate pdf pages',
      'delete pages from pdf',
      'extract pages from pdf',
      'combine pdf without upload',
    ],
    features: [
      'Merge any number of PDFs in a drag-free, arrow-controlled order',
      'Organize pages with real thumbnails: reorder, rotate, delete, restore',
      'Extract precise ranges \u2014 1-3, 7, 12- \u2014 into a fresh PDF',
      'Split every N pages into parts, delivered as individual PDFs or one ZIP',
      'Encrypted files are detected and explained, not silently mangled',
      'Everything is built locally with pdf-lib \u2014 no upload, ever',
    ],
    howItWorks: [
      'Drop one PDF to organize or split, several to merge',
      'Arrange pages, set a range or a parts-per-file count',
      'Rebuild, extract or split \u2014 and download the result',
    ],
  },
  {
    id: 'pdf-view',
    name: 'PDF Viewer',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Read any PDF in the browser \u2014 page nav, zoom, rotation, full-document search.',
    description:
      'Open a PDF and just read it: crisp rendering with page navigation and a direct page box, fit-width or stepped zoom, view rotation, and a search that scans every page and tells you exactly which pages contain the phrase \u2014 click a hit to jump there. The file is rendered locally by pdf.js and never uploaded.',
    icon: 'doc',
    intents: [
      'pdf reader online',
      'open pdf in browser',
      'pdf viewer no download',
      'search inside pdf',
      'read pdf online free',
    ],
    features: [
      'Sharp canvas rendering with device-pixel-ratio awareness',
      'Page box, prev/next and keyboard-friendly navigation',
      'Fit-width by default; stepped zoom and view rotation on demand',
      'Whole-document search that lists matching pages with hit counts',
      'Password-protected files are refused honestly, with the reason',
      'Rendering is local (pdf.js) \u2014 the document never leaves the tab',
    ],
    howItWorks: [
      'Drop the PDF \u2014 page 1 renders immediately',
      'Navigate, zoom, rotate, or search the whole document',
      'Click any search hit to jump to that page',
    ],
  },
  {
    id: 'pdf-text',
    name: 'PDF Text Extractor',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Pull every word out of a PDF \u2014 per page, copyable, downloadable as .txt.',
    description:
      'Turn any text-based PDF into plain text: every page is read locally with pdf.js, shown page by page with character counts, and exported either as one continuous .txt or a page-marked one. Scanned image-only PDFs are detected and reported honestly \u2014 no fake OCR, no silent empty results.',
    icon: 'file-scan',
    intents: [
      'extract text from pdf',
      'pdf to text online',
      'copy text from pdf',
      'pdf text extractor free',
      'convert pdf to txt',
    ],
    features: [
      'Per-page extraction with live progress on big documents',
      'Reading order rebuilt from the text layer\u2019s line-break markers',
      'Copy everything, or download continuous / page-marked .txt',
      'Scanned (image-only) PDFs are detected and explained',
      '100% local \u2014 pdf.js runs in this tab, nothing is sent anywhere',
    ],
    howItWorks: [
      'Drop the PDF \u2014 extraction starts immediately',
      'Watch pages appear with their text and character counts',
      'Copy it all, or download it as a .txt',
    ],
  },
  {
    id: 'images-to-pdf',
    name: 'Images to PDF',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Turn photos and scans into one ordered PDF \u2014 A4 or Letter, margins included.',
    description:
      'Feed in JPEG, PNG, WebP, GIF, BMP or AVIF images and get one PDF with each image on its own page, in your chosen order. Page size is A4, US Letter or exactly the image; orientation follows the image or your pick; margins and JPEG quality are yours to set. Phone photos arrive straight-side-up \u2014 EXIF rotation is applied before embedding. Built locally with pdf-lib.',
    icon: 'images',
    intents: [
      'image to pdf online',
      'jpg to pdf converter',
      'photos to pdf',
      'scan to pdf online',
      'png to pdf free',
      'jpeg to pdf without upload',
    ],
    features: [
      'JPEG, PNG, WebP, GIF, BMP and AVIF input',
      'Ordered pages with up/down controls and a live list',
      'A4, US Letter or fit-to-image pages; auto/portrait/landscape',
      'None, small or large margins; JPEG quality slider for size control',
      'EXIF rotation baked in \u2014 phone photos come out upright',
      'Assembled locally with pdf-lib \u2014 images never leave the device',
    ],
    howItWorks: [
      'Drop your images in any order',
      'Reorder them, pick page size, orientation, margin and quality',
      'Build the PDF and it downloads \u2014 with a size readout',
    ],
  },
  {
    id: 'office-view',
    name: 'Document Viewer',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Read Word, Excel and CSV files in the browser \u2014 convert them too.',
    description:
      'Open .docx, .xlsx, .xls and .csv files without installing anything: Word documents render as formatted HTML inside a locked-down sandbox (headings, lists, tables, images), spreadsheets show as a grid with sheet tabs. Convert on the way out \u2014 DOCX to HTML or plain text, CSV to XLSX, any sheet to CSV. Everything is parsed locally with mammoth and SheetJS.',
    icon: 'sheet',
    intents: [
      'docx viewer online',
      'xlsx viewer free',
      'open word file online',
      'csv to xlsx converter',
      'excel viewer no download',
      'view docx without word',
    ],
    features: [
      'DOCX rendered as clean, formatted HTML in a script-proof sandbox',
      'XLSX/XLS grids with sheet tabs, row counts and expandable limits',
      'Copy document text or the visible grid in one tap',
      'Convert: DOCX \u2192 HTML/.txt, CSV \u2192 XLSX, any sheet \u2192 CSV',
      'Old .doc and PowerPoint are refused honestly, with what to use instead',
      'Parsed locally with mammoth + SheetJS \u2014 no upload, ever',
    ],
    howItWorks: [
      'Drop a .docx, .xlsx, .xls, .csv or .tsv file',
      'Read it \u2014 formatted document or spreadsheet grid',
      'Copy the content or download a converted copy',
    ],
  },
  {
    id: 'epub-view',
    name: 'EPUB Reader',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Read .epub books in the browser \u2014 chapters, contents, text size.',
    description:
      'Open any DRM-free .epub and read it right here: paginated chapters, a table of contents you can jump through, text-size control and a live reading progress bar. Book title and author are read from the file\u2019s own metadata. DRM-protected library books are refused with an honest explanation. Rendered locally with epub.js.',
    icon: 'book-open',
    intents: [
      'epub reader online',
      'read epub in browser',
      'open epub file free',
      'epub viewer no download',
      'read books online without app',
    ],
    features: [
      'Paginated reading with prev/next \u2014 mouse or arrow keys',
      'Full table of contents with nested chapters, one click to jump',
      'Text size from 12 to 28 px, applied without reloading',
      'Title, author and reading progress shown at a glance',
      'DRM files and corrupted books are refused with the reason',
      'Parsed locally with epub.js \u2014 the book never leaves the device',
    ],
    howItWorks: [
      'Drop a .epub book (DRM-free)',
      'Turn pages with the buttons or arrow keys',
      'Open Contents to jump chapters; resize text to taste',
    ],
  },
  {
    id: 'audio',
    name: 'Audio Toolkit',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Trim, merge, speed up and normalize audio \u2014 exported as WAV or MP3.',
    description:
      'One audio bench for quick jobs: cut a clip out of a recording, join several files into one, change playback speed, normalize loudness to a target level, and soften the edges with fades. Everything runs through this browser\u2019s Web Audio engine \u2014 the waveform is drawn from the real samples, and the finished file is encoded on this device as WAV or MP3. Your recordings are never uploaded.',
    icon: 'audiolines',
    intents: [
      'trim audio online',
      'cut mp3 online free',
      'merge audio files online',
      'normalize audio loudness',
      'change audio speed',
      'wav to mp3 converter',
    ],
    features: [
      'Trim with a draggable selection on a real waveform, or type exact seconds',
      'Merge several files into one track, mismatched sample rates aligned first',
      'Speed from 0.25\u00d7 to 4\u00d7 (pitch shifts with it, like tape \u2014 stated, not hidden)',
      'Peak and loudness (RMS) normalization to a dB target you set',
      'Fade-in and fade-out on the exported clip',
      'Export as 16-bit WAV or MP3 at 128 / 192 / 320 kbps',
    ],
    howItWorks: [
      'Drop an audio file \u2014 the waveform draws from the decoded samples',
      'Set the selection, speed, level and fades',
      'Render, then download WAV or MP3',
    ],
  },
  {
    id: 'gif',
    name: 'GIF Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Turn a video clip into a GIF, or shrink a GIF \u2014 all in this tab.',
    description:
      'Two jobs, one page. Take a short video (WebM or MP4) and sample it into a proper looping GIF \u2014 you pick the moment, the frame rate, the width. Or take an existing GIF and make it lighter: scale it down, skip frames, re-encode it. Frames are captured with the browser\u2019s video decoder and encoded locally with a per-frame palette, so the quality of the color table is real, not a re-wrap. Nothing uploads.',
    icon: 'film',
    intents: [
      'video to gif converter',
      'make gif from video online',
      'compress gif online',
      'resize gif without losing quality',
      'mp4 to gif free',
      'webm to gif',
    ],
    features: [
      'Video \u2192 GIF with start point, length, fps and width under your control',
      'Per-frame color quantization with optional dithering for gradients',
      'GIF \u2192 smaller GIF: scale, frame-skip and re-encode with live size preview',
      'Frame count, delay and both sizes shown before you download',
      'Runs on the browser\u2019s own video engine \u2014 no queue, no watermark',
    ],
    howItWorks: [
      'Drop a video to make a GIF, or a GIF to shrink one',
      'Set the range, size and frame rate (or scale + frame skip)',
      'Render, check the before/after sizes, download the GIF',
    ],
  },
  {
    id: 'frame-grab',
    name: 'Frame Grabber',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Pull still PNG frames out of any video \u2014 one shot or the whole clip.',
    description:
      'Scrub a video to the exact moment and grab it as a full-resolution PNG, or sweep the whole clip and take a frame every few seconds (or an even number of frames) in one pass. Every frame comes from this browser\u2019s video decoder at native resolution \u2014 no proxy, no compression service, no upload. Batch results land in a contact sheet you can download one by one or all together as a ZIP.',
    icon: 'frame',
    intents: [
      'extract frames from video',
      'video to png online',
      'screenshot video frame',
      'export video thumbnails',
      'grab frame from mp4',
    ],
    features: [
      'Scrub anywhere and grab the exact frame at native resolution',
      'Batch sweep: every N seconds or an even count across the clip',
      'Frames preview as a contact sheet \u2014 keep some, discard the rest',
      'Download a single PNG or the whole set as a ZIP',
      'Decoded locally \u2014 the video never leaves this device',
    ],
    howItWorks: [
      'Drop a video (WebM or MP4 your browser can play)',
      'Scrub to a moment and grab it, or sweep the whole clip',
      'Pick frames from the contact sheet, download PNGs or a ZIP',
    ],
  },
  {
    id: 'recorder',
    name: 'Screen & Mic Recorder',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Record your screen or microphone to a file \u2014 it never leaves this device.',
    description:
      'Record the screen, a window or a tab (with your microphone mixed in if you want narration), or record voice alone. The capture runs on the browser\u2019s own recorder and saves a WebM you download the moment you stop \u2014 there is no upload step, no cloud folder, no processing service in between. Pause and resume mid-take, watch the elapsed time, and keep the file only if it is the take you wanted.',
    icon: 'circle-dot',
    intents: [
      'screen recorder online',
      'record screen browser',
      'voice recorder online',
      'screen recording with microphone',
      'webm screen recorder',
    ],
    features: [
      'Record a screen, window or browser tab \u2014 you choose the surface',
      'Mix microphone audio into the screen capture, or record voice alone',
      'Pause and resume; the timer only counts recorded time',
      'Watch a live muted preview while recording',
      'Stop and the file is ready \u2014 download it or discard it, nothing saved remotely',
    ],
    howItWorks: [
      'Pick screen or microphone and grant the browser permission',
      'Record \u2014 pause and resume as needed while the timer runs',
      'Stop, preview the take, download it or throw it away',
    ],
  },
  {
    id: 'upscaler',
    name: 'Image Upscaler',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Make images bigger with clean edges \u2014 2\u00d7 to 4\u00d7, sharpened locally.',
    description:
      'Enlarge a photo 2\u00d7, 3\u00d7 or 4\u00d7 (or to an exact width) using stepped high-quality resampling \u2014 doubling in stages beats one giant jump \u2014 followed by an unsharp-mask pass with a strength you control, so edges stay crisp instead of mushy. The before/after sizes and file weights are shown side by side. Honest by design: this is careful resampling and sharpening, not an invented-detail AI model. Every pixel is computed in this tab.',
    icon: 'expand',
    intents: [
      'image upscaler online',
      'enlarge image without losing quality',
      'upscale photo 4x',
      'increase image resolution online',
      'sharpen enlarged image',
    ],
    features: [
      '2\u00d7, 3\u00d7, 4\u00d7 or a target width \u2014 your choice, with the math shown',
      'Stepped resampling: doubling in stages preserves far more than one jump',
      'Unsharp-mask sharpening with a strength slider, applied on the enlarged image',
      'Before/after dimensions and file sizes, side by side',
      'Export as PNG (lossless) or JPEG/WebP at a quality you pick',
    ],
    howItWorks: [
      'Drop an image (PNG, JPEG or WebP)',
      'Choose the enlargement and sharpening strength',
      'Compare before/after, then download the result',
    ],
  },
  {
    id: 'archive',
    name: 'Archive Explorer',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Open .tar and .tar.gz archives, take what you need, build new ones — all on this device.',
    description:
      'A real TAR toolkit built on a hand-written ustar reader: .tar, .tar.gz, .tgz and .gz files are parsed block by block in this tab, every header checksum is verified, and each entry shows its size, type and timestamp before you take anything. Pull out a single file or a whole selection, rebuilt into a ZIP with folder structure intact, or pack files and folders into a fresh .tar.gz with the matching writer. GNU long names and PAX path records are handled honestly, symlinks are listed but never extracted, and nothing is uploaded because there is no upload code.',
    icon: 'archive',
    intents: [
      'open tar.gz online',
      'extract tar archive in browser',
      'view tar contents without extracting',
      'create tar.gz online',
      'gzip a file online',
      'decompress gz file in browser',
      'open tar archive on chromebook',
      'tar extractor no install',
    ],
    features: [
      'Opens .tar, .tar.gz, .tgz and .gz — any file is detected by its magic bytes',
      'Every entry listed with size, type badge and modification time before extraction',
      'Select entries and rebuild them into a ZIP with folder structure preserved, locally',
      'Hand-written ustar reader and writer: checksum verification, GNU long names, PAX path records',
      'Build a .tar.gz from loose files or a whole folder, structure intact',
      'One-file gzip and gunzip with the browser’s native compression engine',
    ],
    howItWorks: [
      'Drop a .tar/.tar.gz/.tgz/.gz to list its contents, every header verified first',
      'Tick entries and download them as a ZIP, or take a single file out',
      'Or build: pick files or a folder for a .tar.gz, or gzip one file',
    ],
  },
  {
    id: 'file-tools',
    name: 'File Workshop',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Split big files into verified parts, rejoin them, rename a batch and hunt duplicates — all on this device.',
    description:
      'Five real file operations in one local tab: split a file by size or part count, with a manifest that records the original SHA-256; rejoin parts with size and whole-file hash verification before anything downloads; bulk-rename a batch with a live preview and duplicate-name detection; set, replace or append extensions; and group duplicate files by exact size, a first+last-64 KB fingerprint and full SHA-256, with a suggested keeper per group. Parts download individually or as one ZIP, and nothing is ever uploaded because there is no upload code on the page.',
    icon: 'file-tools',
    intents: [
      'split a large file into parts',
      'join split file parts back together',
      'merge part001 part002 files',
      'split a file to fit an email attachment limit',
      'bulk rename multiple files online',
      'rename a batch of files with numbering',
      'change file extension to another',
      'find duplicate files in a folder',
      'find duplicate photos by content',
    ],
    features: [
      'Split by exact size (KB/MB) or into N equal parts, with a per-part size table and a one-click ZIP of the parts',
      'Every split ships a .manifest.json recording the original name, size, SHA-256, part count and part sizes',
      'Merge verifies part order, total size and the whole-file SHA-256 — and says so honestly when something does not match',
      'Bulk rename with find/replace, prefix, suffix, numbering and case, previewed live with collision detection',
      'Duplicate finder: size groups, partial hash, full SHA-256 up to 256 MB, suggested keeper per group, keeper-list download',
      'Everything runs in this tab — no uploads, no account, files never leave the device',
    ],
    howItWorks: [
      'Pick a file and split it by size or part count — download the parts plus the manifest',
      'Later, pick the parts (manifest first if you have it) and rejoin the original, verified before download',
      'Or work the batch: rename files, swap extensions or group duplicates, then download the results',
    ],
  },
  {
    id: 'encrypt',
    name: 'Encrypt',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Password-encrypt files or text with AES-256-GCM right in this tab — the key never leaves it.',
    description:
      'Real encryption, not an encoding: AES-256-GCM with the key stretched from your password by PBKDF2-SHA256 at 310,000 iterations, a fresh random salt and IV for every operation. Files wrap into a documented .enc container that decrypts back to the original bytes — including on this page — and text wraps into the same container as Base64 you can paste into a chat and unlock later. Everything runs locally in the browser: there is no upload code, so your plaintext and your password never leave the device, and a wrong password refuses to decrypt instead of producing garbage.',
    icon: 'encrypt',
    intents: [
      'encrypt a file with a password',
      'password protect a file no upload',
      'aes 256 online',
      'encrypt text with a password in the browser',
      'open a .enc encrypted file',
      'send a file only the recipient can open',
      'encrypt a document before emailing it',
      'aes-gcm encryption in the browser',
    ],
    features: [
      'AES-256-GCM — the authenticated cipher browsers use for TLS, so tampering breaks the decrypt instead of slipping through',
      'Keys are stretched with PBKDF2-SHA256 at 310,000 iterations, with a fresh 16-byte salt and 12-byte IV every operation',
      'A documented KENC1 container — magic, version, salt, IV, ciphertext — with the byte layout printed on the page',
      'A wrong password or a damaged file is reported honestly instead of producing garbage',
      'Live password strength meter with an entropy estimate and a check against the most common passwords',
      'Runs entirely in this tab — no account, no upload code, nothing stored',
    ],
    howItWorks: [
      'Drop a file or paste text, type a password twice, press encrypt — download the .enc or copy the Base64 container',
      'To open it later, drop the .enc or paste the Base64, type the same password, and decrypt in the same tab',
      'A wrong password or a damaged container is refused honestly — there is no recovery, so keep the password safe',
    ],
  },
  {
    id: 'meta-scrub',
    name: 'Metadata Cleaner',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'See every metadata record a photo carries — GPS included — then strip them losslessly, on this device.',
    description:
      'A real EXIF viewer and scrubber for JPEG and PNG photos, built on hand-written parsers: the JPEG path walks segment markers and decodes the EXIF IFDs (camera, lens, serial numbers, timestamps, orientation, flash, and GPS as decimal degrees), while the PNG path walks chunks with checksum verification and decodes text chunks and the eXIf block. The scrub is byte surgery, not a re-encode: JPEG is rebuilt from its structural segments only, so pixels stay byte-identical while every APPn/COM container is cut, and PNG is rebuilt from its critical chunks with checksums recomputed. The cleaned file is re-parsed in memory as proof that zero records remain, and nothing is uploaded because there is no upload code.',
    icon: 'meta-scrub',
    intents: [
      'remove exif data from photo',
      'photo metadata remover',
      'strip gps from photos',
      'exif viewer online',
      'remove location from pictures',
      'delete camera info from jpg',
      'view photo exif online',
      'clean image metadata before sharing',
    ],
    features: [
      'Hand-written EXIF reader: IFD0, Exif and GPS directories decoded into a human table — camera, lens, serials, timestamps, orientation, flash, exposure',
      'GPS coordinates shown as decimal degrees with hemisphere, altitude and fix time, highlighted in amber the moment they are found',
      'JPEG scrub is a lossless segment strip — pixels stay byte-identical, only APPn/COM segments are cut, with every dropped segment listed by name and size',
      'PNG scrub rebuilds the file from critical chunks (IHDR/PLTE/IDAT/IEND) with checksums recomputed',
      'A proof pass re-parses the cleaned file in memory and shows the resulting record count instead of promising',
      'Runs entirely in this tab — no upload code, files never leave the device',
    ],
    howItWorks: [
      'Drop a JPEG or PNG — every metadata record is parsed and shown, GPS flagged the moment it appears',
      'Press scrub: metadata segments are cut (or the PNG rebuilt from critical chunks), and the dropped list is shown with sizes',
      'The cleaned file is re-parsed as proof, then downloads under your original name plus "-clean"',
    ],
  },
  {
    id: 'jwt',
    name: 'JWT Inspector',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Decode a JSON Web Token, read its claims with expiry in your local time and verify its signature — all in this tab.',
    description:
      'Paste a token and the header and payload decode instantly with a hand-written base64url reader and strict UTF-8, with the exact byte position of any parse error; every standard claim is explained in plain language and epoch seconds become local dates with "in 3 h 12 m" distances, under VALID, EXPIRED or NOT YET VALID badges computed against your device clock. Signatures verify locally with WebCrypto: HS256/384/512 against a pasted shared secret, RS*/PS*/ES* against a pasted JWK or JWKS entry, with alg "none" flagged loudly as an unsigned token nobody should trust. There is no upload code on the page — the token and any key you paste never leave the device.',
    icon: 'jwt',
    intents: [
      'decode jwt online',
      'jwt debugger',
      'check jwt expiration',
      'verify jwt signature locally',
      'decode jwt payload base64url',
      'is my jwt expired',
      'verify hs256 jwt in browser',
      'inspect jwt claims offline',
      'jwt decoder no upload',
    ],
    features: [
      'Full decode of header and payload with strict base64url + UTF-8 handling and the exact byte position of any parse error',
      'Standard claims explained in plain language, with epoch seconds shown as local dates and relative distances like "in 3 h 12 m"',
      'VALID, EXPIRED and NOT YET VALID badges computed against your device clock, with the current local time shown beside the verdict',
      'Local signature verification with WebCrypto: HS* against a pasted shared secret, RS*/PS*/ES* against a pasted JWK or JWKS entry',
      'alg "none" flagged loudly as unsigned; symmetric and asymmetric schemes labeled with what each one implies',
      'Runs entirely in this tab — no upload code, no storage, one Clear button wipes token and keys',
    ],
    howItWorks: [
      'Paste the token — header and payload decode instantly, with claim explanations, expiry status and a live device-clock line',
      'For verification, paste the shared secret (HS*) or the public JWK (RS*/PS*/ES*) and the signature is checked locally with WebCrypto',
      'Press Clear when you are done — the token, the keys and the verdicts are wiped from the tab',
    ],
  },
  {
    id: 'hash-file-batch',
    name: 'Batch Checksums',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Checksum every file in a pile or a folder, export sha256sum-compatible lists and verify pasted checksums — all on this device.',
    description:
      'Drop files or pick a folder and every MD5, SHA-1 and SHA-256 is computed in a sequential queue with honest per-file status, streamed 8 MB at a time so the page stays alive on multi-GB jobs. Exports follow the GNU two-space format (checksums.sha256, .sha1, .md5) that sha256sum -c reads directly, plus CSV and JSON, and a verify mode pastes any checksum list back and marks each entry OK, MISMATCH or NOT FOUND like a visual sha256sum -c. There is no upload code on this page: every byte is hashed in this tab and never leaves the device.',
    icon: 'hash-file-batch',
    intents: [
      'batch file checksum',
      'generate checksum list for folder',
      'sha256sum windows alternative',
      'verify checksums online no upload',
      'md5 multiple files at once',
      'create sha256 checksum file',
      'check file integrity after backup',
      'sha256sum -c in browser',
      'batch md5 sha256 checker',
    ],
    features: [
      'Drop a pile of files or pick a whole folder — the queue lists name, path, size and status immediately and hashes sequentially with a live progress bar and elapsed times',
      'MD5, SHA-1 and SHA-256 selectable; files up to 64 MB use WebCrypto, larger ones stream through incremental 8 MB chunks so the UI never freezes',
      'Exports in the GNU two-space format that sha256sum -c / sha1sum -c / md5sum -c read directly — .sha256, .sha1 and .md5, plus CSV and JSON',
      'Verify mode parses any pasted checksum list ("HASH  name", "HASH *name" or "name=HASH") and marks each entry OK, MISMATCH or NOT FOUND with counts',
      'A one-press self-test hashes "abc" against the published MD5/SHA-1/SHA-256 vectors and cross-checks WebCrypto, reporting PASS or FAIL honestly',
      'Caps stated up front: 2 GB per file (refused honestly), 8 GB queue soft cap with a warning — and nothing ever uploads',
    ],
    howItWorks: [
      'Drop files or pick a folder, tick the digests you want (MD5 + SHA-256 by default) and press Start hashing',
      'Watch the queue: each row shows pending, hashing with live progress, done with its elapsed time, or an honest failure reason',
      'Export the checksum list (.sha256/.sha1/.md5, CSV or JSON), or paste an existing list into Verify to check your files against it',
    ],
  },
  {
    id: 'cron',
    name: 'Cron Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Parse a cron expression, read it in plain English and preview its next fire times — computed on this device.',
    description:
      'A hand-written cron engine, no library: 5-field crontab syntax and 6-field seconds-first (Quartz and lockfile) syntax are parsed into exact value sets — names, ranges, steps, lists and the classic Vixie day-of-month OR day-of-week rule included — and every parse error names its field and the exact offending value. The expression becomes a real English sentence, and a next-runs grid computes upcoming fire times against your device clock with a 366-day cap, plus per day/week/month load estimates that are labeled as simulations. Quartz-only syntax (?, L, W, # and year fields) is refused with precise explanations instead of guessed at, because a silently wrong schedule is worse than an honest refusal.',
    icon: 'cron',
    intents: [
      'cron expression generator',
      'crontab explained',
      'cron next run calculator',
      'every 5 minutes cron',
      'cron expression meaning',
      'what does my cron expression do',
      'cron every day at 3am',
      'quartz cron expression checker',
      'cron 0 9 * * MON-FRI meaning',
      'test cron expression online no upload',
    ],
    features: [
      'Hand-written parser: 5-field crontab and 6-field seconds-first (Quartz) with names, ranges, steps and lists — errors name the field and the exact value',
      'Plain-English sentence for common shapes, composed field-by-field for exotic ones, with the next-runs grid shown as ground truth',
      'Next 5/10/20 fire times computed locally against your device clock, with relative distances and an honest DST note',
      'The Vixie dom/dow OR rule applied and explained whenever both day fields are restricted — the classic 0 0 13 * FRI gotcha',
      'Per day/week/month load estimates simulated over a representative window, labeled as a simulation',
      'Runs entirely in this tab — no cron library, no upload code, the expression never leaves the device',
    ],
    howItWorks: [
      'Type or paste a cron expression, or tap a preset — it parses as you type with per-field errors',
      'Read the plain-English sentence and the field-by-field breakdown, including the dom/dow OR rule when it applies',
      'Check the next fire times against your device clock and the simulated per day/week/month loads',
    ],
  },
  {
    id: 'diff',
    name: 'Text Diff',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Compare two texts line by line, see exactly which words moved, and export a patch that applies.',
    description:
      'A real patience diff — the same strategy git diff --patience uses — running in this tab: unique common lines anchor the diff, the longest increasing subsequence of anchors forms the spine, and everything between is diffed recursively, so large rearranged files produce readable results instead of a wall of red. Replaced line pairs get a second word-level pass that highlights the exact words that moved. Side-by-side and inline views carry real line numbers, live add/remove/unchanged counts and a similarity percentage, with case, whitespace and blank-line options that re-run the diff as you flip them. The unified-diff export writes true ---/+++/@@ hunks with correct hunk-start math and \\ No newline at end of file handling — verified to apply with git apply and reconstruct the target byte for byte, including files without trailing newlines.',
    icon: 'diff',
    intents: [
      'text diff checker online',
      'compare two text files',
      'diff two paragraphs',
      'side by side diff',
      'git diff online without install',
      'unified diff generator',
      'compare code versions online',
      'what changed between two texts',
    ],
    features: [
      'Patience diff with recursion and a depth-bounded fallback — always a correct diff, readable on rearranged files',
      'Word-level highlighting inside edited lines: the exact removed and added words are marked, not the whole line',
      'Side-by-side and inline views with real line numbers, synced pairing, and live +added / −removed / unchanged stats',
      'Ignore-case, ignore-whitespace and ignore-blank-lines options that recompute the diff as you toggle them',
      'Unified diff export with 3-line context hunks — applies with git apply or patch -p1, byte-exact reconstruction verified',
      'Computed in this tab as you type — no upload code on the page, texts never leave the device',
    ],
    howItWorks: [
      'Paste the original on the left and the changed text on the right — the diff appears as you type',
      'Toggle the ignore options and the view; edited lines show their changed words highlighted',
      'Copy or download the unified patch and apply it with git apply / patch -p1',
    ],
  },
  {
    id: 'uuid',
    name: 'ID Generator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'UUID v4, UUID v7 and ULID in bulk — plus an inspector that decodes what an ID really carries.',
    description:
      'Three identifiers, one page, all from the browser crypto engine. UUID v4 shapes 122 random bits with the RFC 4122 version and variant bits. UUID v7 (RFC 9562) embeds a 48-bit Unix-millisecond timestamp ahead of the random bits, so IDs sort by creation time — the format databases increasingly want for primary keys. ULID packs the same idea into 26 Crockford-base32 characters with an optional monotonic mode that guarantees strictly increasing IDs even inside a tight loop. Bulk generation runs to 500 at once with per-row copy and copy-all, plus uppercase and hyphen-free variants. The inspector decodes any of the three back into parts — version nibble, variant bits, the embedded timestamp — and validates ULIDs against the Crockford alphabet, rejecting I, L, O and U with an explanation instead of a shrug.',
    icon: 'uuid',
    intents: [
      'uuid generator online',
      'uuid v7 generator',
      'ulid generator',
      'generate uuid v4 in browser',
      'bulk uuid generator',
      'decode uuid version',
      'uuid vs ulid',
      'monotonic ulid online',
    ],
    features: [
      'UUID v4 from crypto.getRandomValues — 122 random bits, proper version and variant bits, no Math.random',
      'UUID v7 per RFC 9562: 48-bit millisecond timestamp + random bits, sortable by creation time',
      'ULID with Crockford base32 (no I/L/O/U) and an honest monotonic mode: same-millisecond IDs increment, never repeat',
      'Bulk 1–500 with per-row and copy-all, uppercase and hyphen-free output variants',
      'Inspector decodes version, variant and the hidden timestamp of v1/v7 UUIDs and ULIDs',
      'Generated locally in this tab — there is no upload code on the page at all',
    ],
    howItWorks: [
      'Pick a format and a count — IDs appear immediately, regenerated live as you change anything',
      'Copy one row or all of them; uppercase and hyphen-free variants apply on the fly',
      'Switch to Inspect and paste an ID to see its version, variant and embedded timestamp',
    ],
  },
  {
    id: 'convert-units',
    name: 'Unit Converter',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Convert 73 units across 10 categories, number bases 2–36 and Roman numerals — exact factors, computed on this device.',
    description:
      'One page, three converters. Seventy-three units across ten categories (length, mass, temperature, volume, data, speed, area, time, pressure, energy) convert through exact published factors — the inch is exactly 0.0254 m, the pound exactly 0.45359237 kg — with temperature special-cased as affine formulas and the decimal and binary data families (KB vs KiB) labeled side by side. Numbers convert between bases 2 and 36 with bit length, byte length and two\'s-complement 8/16/32/64-bit views, honestly guarded to 2^53 − 1, and Roman numerals parse under the strict classical grammar, rejecting forgeries like IIII or IC with the precise rule that was broken. Every conversion is computed in this tab — there is no upload code on the page.',
    icon: 'convert-units',
    intents: [
      'unit converter',
      'cm to inches',
      'convert celsius to fahrenheit',
      'kg to pounds',
      'binary to decimal',
      'decimal to hexadecimal',
      'roman numeral converter',
      'KB to KiB converter',
      'miles to km converter',
      'convert units online no upload',
    ],
    features: [
      'Ten categories and 73 units on exact factor tables — 1 in = 2.54 cm, 1 lb = 0.45359237 kg — with an “exact” note only when the ratio truly terminates',
      'Two live inputs: type in either side and the other converts as you type, with 4–12 significant digits of precision control (7 by default)',
      'Temperature handled by its own affine formulas (°F = °C × 9/5 + 32), never by a multiplying factor; decimal and binary data units (KB vs KiB) labeled side by side',
      'Number bases 2–36: four live rows for 2/8/10/16 plus any base, with bit length, byte length and two\'s-complement 8/16/32/64-bit views, honestly guarded to 2^53 − 1',
      'Roman numerals both ways under the strict classical grammar — malformed input like IIII, VX or IC is rejected with the precise rule it breaks, plus a full breakdown (1987 = M + CM + L + XXX + V + II)',
      'Runs entirely in this tab — no session, no account, no upload code; nothing is sent anywhere',
    ],
    howItWorks: [
      'Pick a category chip, choose the two units and type in either field — the other side converts live, at the digit precision you set',
      'For numbers, edit any base row (or pick base 2–36) and every other row, the bit/byte counts and the two\'s-complement views follow',
      'For Roman numerals, type a number to get its breakdown, or paste a numeral — valid ones resolve, malformed ones say exactly which classical rule they break',
    ],
  },
  {
    id: 'lorem',
    name: 'Placeholder Text Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Lorem ipsum or plain-English filler, paragraphs to lists, rebuilt identically from a seed — generated on this device.',
    description:
      'Placeholder copy that behaves: two corpora (the classic Latin Lorem Ipsum vocabulary and a plain-English wireframe filler that does not read as Latin), four shapes (paragraphs, sentences, bare words, bullet lists), the traditional “Lorem ipsum dolor sit amet” opening as a toggle, and an optional HTML mode that wraps every paragraph in <p> tags. The generator is seeded — xmur3 hashes the seed string, mulberry32 drives the picks — so the same seed with the same settings always rebuilds the exact same text, which is what makes a wireframe’s filler survive a refresh or a teammate’s review. Nothing is stored, nothing is sent anywhere.',
    icon: 'lorem',
    intents: [
      'lorem ipsum generator',
      'placeholder text for wireframes',
      'dummy text generator',
      'lorem ipsum paragraphs',
      'filler text for mockups',
      'lorem ipsum html p tags',
      'greeked text generator',
      'plain english filler text',
    ],
    features: [
      'Two corpora: the classic Latin vocabulary the standard filler is built from, and a plain-English interface word bank for prototypes shown to non-Latinists',
      'Four shapes — paragraphs (3–7 sentences each), sentences grouped five per paragraph, a bare word block, and bullet-list items',
      'Seeded generator (xmur3 + mulberry32): the same seed and settings always produce the identical text, and the dice button rolls a fresh readable seed',
      'The traditional “Lorem ipsum dolor sit amet…” opening as a toggle, and an HTML mode that emits one <p> per paragraph, ready to paste into markup',
      'Live word, character and paragraph counts on the output pane, copy in one tap, regenerate as you change any setting',
      'Runs entirely in this tab — no account, no upload code, the text never leaves the device',
    ],
    howItWorks: [
      'Choose a shape, corpus and count — the text builds as you type, with the word and character counters keeping you honest',
      'Type a seed (or roll the dice) to pin this exact text; share the seed with a teammate and their page rebuilds the same filler',
      'Copy the text, or flip on the HTML mode and copy <p>-wrapped paragraphs straight into your mockup',
    ],
  },
  {
    id: 'fake-data',
    name: 'Fake Data Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Realistic-looking, guaranteed-fake test records with names, e-mails, addresses and more — reproducible from a seed, exportable as CSV or JSON.',
    description:
      'Test data that cannot bite anyone. Pick a name locale (English, German, French, Spanish, Indian, Japanese romaji), toggle the fields you need — full name, username, e-mail, phone, street and city, company, job title, birthday with age, IPv4, user agent, color — and generate up to 500 records, shown as a table and exportable as CSV or JSON. Every value stays inside officially reserved space by construction: e-mails only use the IANA-reserved example.* domains, North-American phones only the 555-01XX fictional exchange, other locales’ numbers start with a digit that makes them undialable internationally, and IPv4s come from the RFC 5737 documentation blocks. The generator is seeded, so “row 14 breaks the form” can be reproduced exactly by re-entering the seed.',
    icon: 'fake-data',
    intents: [
      'fake data generator',
      'dummy user data csv',
      'test data generator json',
      'fake name and address generator',
      'mock user records for forms',
      'sample data for spreadsheet testing',
      'fake profiles with example.com email',
      'generate 100 test users',
    ],
    features: [
      'Twelve toggleable fields across six name locales, from full names and e-mails to user agents and hex colors',
      'Reserved-space honesty: example.* e-mail domains, the 555-01XX fictional phone exchange, RFC 5737 documentation IPs — nothing maps to a real person',
      'Seeded generation: the same seed, locale and fields rebuild the identical dataset, so a bug report can name a row and be reproduced',
      'Up to 500 records per run, table preview of the first 25 with the full set in the export',
      'CSV export with proper quoting and JSON export pretty-printed — both download straight from this tab',
      'Everything is generated on this device; there is no upload code on the page',
    ],
    howItWorks: [
      'Pick a locale, toggle the fields, set how many records — the table fills as you change anything',
      'Type a seed (or roll the dice) to pin the dataset; re-entering the same seed later rebuilds the same records',
      'Copy the whole set as JSON, or download it as CSV / JSON for your test suite or spreadsheet',
    ],
  },
  {
    id: 'css-tools',
    name: 'CSS Style Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Gradient, box-shadow and border-radius generators with live previews — copy the exact CSS you are looking at.',
    description:
      'Three generators under one roof, each showing a real element styled with the same state that produces the copied CSS, so what you see is byte-for-byte what you get. Gradients build linear, radial and conic fills with up to eight draggable color stops, an angle dial and a center-point control, plus five presets from Sunrise to a color wheel. Box shadows compose up to six layers — offset, blur, spread, color with alpha, inset — with presets from subtle card to ring-plus-shadow. Border-radius drives four independent corner sliders with a link-all toggle and shapes from pill to leaf to blob. Every tab emits formatted, copy-ready CSS and runs entirely on this device.',
    icon: 'css-tools',
    intents: [
      'css gradient generator',
      'box shadow generator',
      'border radius generator',
      'css generator with preview',
      'conic gradient css',
      'multiple box shadow layers',
      'radial gradient position css',
      'blob border radius css',
    ],
    features: [
      'Gradients: linear, radial and conic, up to eight color stops with per-stop position sliders, angle and center-point controls, five presets',
      'Box shadows: up to six compositing layers — offset X/Y, blur, spread, hex-with-alpha color, inset — with card, raised, floating, inset-well and ring presets',
      'Border radius: four independent corner sliders or linked-all mode, presets from subtle 8px to pill to asymmetric blob shapes',
      'The preview element is styled by the exact same state that emits the CSS — no rendering gap between what you see and what you copy',
      'Copy-ready, formatted CSS from every tab, including a TL TR BR BL comment when the corners differ',
      'Runs entirely in this tab — no account, no upload, nothing sent anywhere',
    ],
    howItWorks: [
      'Pick the Gradient, Box shadow or Border radius tab and shape the controls — the preview updates live beside them',
      'Start from a preset if you like, then adjust stops, layers or corners until it looks right',
      'Copy the CSS from the pane under the controls and paste it into your stylesheet',
    ],
  },
  {
    id: 'meta-tags',
    name: 'Meta Tag Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Build the <head> snippet for search and social, with live search-result, X-card and Open-Graph previews — generated on this device.',
    description:
      'The tags that decide how a link looks everywhere it is shared, built and previewed in one page. Fill in the title, description, canonical URL, site name and image, pick og:type, the X card flavor, locale and robots policy, and the page emits a clean, ordered, escaped <head> snippet — quotes and angle brackets in your copy cannot break the tag structure. Three live previews render from the same fields: a search-result snippet with the real clamping behavior, an X summary_large_image card, and the Open-Graph card Facebook, LinkedIn and Slack show. Ideal-length guidance runs as you type — titles 50–60 characters, descriptions 120–158 — measured honestly against the limits crawlers enforce.',
    icon: 'meta-tags',
    intents: [
      'open graph generator',
      'meta tag generator',
      'og image preview tool',
      'twitter card preview',
      'google search snippet preview',
      'social share preview tool',
      'og meta tags html',
      'check how my link looks when shared',
    ],
    features: [
      'One emitted snippet with title, description, canonical, robots, theme-color, the full Open Graph set and the X card tags — properly ordered and HTML-escaped',
      'Search-result preview that clamps title and description exactly like a results page does',
      'X card (summary and summary_large_image) and Open-Graph card previews rendering from the same fields',
      'Live length guidance: 50–60 ideal for titles, 120–158 for descriptions, with the over-limit distance named',
      'og:type, card flavor, seven locales and a four-way robots policy as honest dropdowns, theme color as a picker',
      'Everything happens in this tab — no crawler is fetched, nothing is submitted anywhere',
    ],
    howItWorks: [
      'Fill the fields on the left — the three previews on the right update as you type',
      'Watch the length hints under the title and description until they land in the sweet spot',
      'Copy the snippet and paste it into your page’s <head>',
    ],
  },
  {
    id: 'barcode',
    name: 'Barcode Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Scannable Code 128 and EAN-13 barcodes as crisp SVG or print-safe PNG, with checksum validation — rendered on this device.',
    description:
      'Two encoders, one page, no lookup service. Code 128 takes any ASCII text (package codes, SKUs, serials, asset tags) and EAN-13 takes retail digits with real checksum discipline: give it 12 digits and the mod-10 check digit is computed and appended; give it 13 and it is verified, with the exact expected digit named on mismatch — and a non-digit reports its position. Bar codes render as vector SVG with adjustable bar width and height and an optional human-readable value underneath, download as SVG for print or a 3× PNG for screens, and stay local: there is no account, no watermark and nothing sent anywhere.',
    icon: 'barcode',
    intents: [
      'barcode generator',
      'code 128 generator',
      'ean 13 barcode generator',
      'ean 13 check digit calculator',
      'barcode svg download',
      'free barcode generator no watermark',
      'sku barcode generator',
      'make a barcode for inventory',
    ],
    features: [
      'Code 128 for any ASCII text and EAN-13 for retail digits, both rendered by the battle-tested JsBarcode engine into crisp vector SVG',
      'EAN-13 checksum discipline: 12 digits get the mod-10 check digit computed and appended, 13 are verified, failures name the expected digit and position',
      'Bar width (1–4×) and height (40–200 px) controls with the human-readable value optional underneath',
      'SVG export for print-perfect vectors and a 3× PNG export with white underlay for screens and documents',
      'Honest validation: non-digits and out-of-alphabet characters report their exact position instead of silently encoding garbage',
      'Runs entirely in this tab — no lookup service, no account, nothing uploaded',
    ],
    howItWorks: [
      'Pick the format and type the content — the barcode renders as you type, with validation errors naming the exact offending character',
      'Dial the bar width and height until it matches where it will be printed or shown',
      'Download the SVG for print or the 3× PNG for screens, or copy the encoded value',
    ],
  },
  {
    id: 'calculator',
    name: 'Calculator Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'A real calculator with a scientific mode: expressions, functions, memory keys and a running tape — computed locally, never guessed.',
    description:
      'The calculator this page should have shipped with: type or tap a full expression — 12 × (3 + 4)² ÷ 5, sin(30) + log(1000), 7! ÷ 2 — and it is parsed by a real shunting-yard tokenizer that respects precedence, parentheses and unary minus, then evaluated without a single eval(). Basic mode keeps the everyday pad; Scientific mode adds trigonometry (with an honest DEG/RAD switch), logarithms, powers, roots, factorials and the π and e constants. Memory keys (MS/MR/M+/M−) and ANS work like the physical calculator you grew up with, every calculation lands on a scrollable tape you can reuse, and the whole thing answers as you type — with a clear error message when an expression is malformed or divides by zero, never a silent wrong number.',
    icon: 'calculator',
    intents: [
      'online calculator',
      'scientific calculator online',
      'expression calculator',
      'calculator with history',
      'free calculator no ads',
      'percentage calculator expression',
      'sqrt log calculator online',
    ],
    features: [
      'Full expression parser (shunting-yard, no eval): precedence, parentheses, unary minus, postfix factorial and percent handled the way a math teacher would',
      'Scientific mode: sin/cos/tan and inverses with a DEG/RAD switch, ln/log, square and nth powers, square root, e^x, factorial, π and e',
      'Memory keys MS / MR / M+ / M− and ANS, exactly like the hardware calculator in your desk drawer',
      'A running tape of every calculation this session — tap any line to reuse its result',
      'Live result preview while you type, keyboard support (digits, operators, Enter, Backspace, Escape) and big touch-friendly pads on phones',
      'Errors are named, not hidden: division by zero, unbalanced parentheses and malformed numbers all get a specific message',
    ],
    howItWorks: [
      'Type or tap the expression — the evaluated result appears live under the input before you commit it',
      'Press Enter or = to commit: the result becomes ANS and the calculation lands on the tape',
      'Switch to Scientific for functions and constants; use the memory keys to store and recall values across calculations',
    ],
  },
  {
    id: 'percentage',
    name: 'Percentage Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Every percentage question in one page: of-value, share, change, discounts, tips with splitting, and sales tax — formulas shown, computed live.',
    description:
      'Six percentage calculators that people actually search for, merged into one page because they share one idea. What is X% of Y; X is what percent of Y; the percent change from X to Y (with the increase/decrease direction named); a discount calculator that shows the final price and exactly how much you saved; a tip calculator with group splitting; and a sales tax/VAT mode that adds tax to a net price or extracts it back out of a gross one. Every mode shows the formula it used — no black-box numbers — and each result has a one-tap copy. Everything is computed in this tab as you type.',
    icon: 'percentage',
    intents: [
      'percentage calculator',
      'discount calculator',
      'tip calculator',
      'percent change calculator',
      'percentage increase decrease',
      'sales tax calculator',
      'vat calculator',
      'what is x percent of y',
    ],
    features: [
      'Six modes on one page: of-value, share (X is what % of Y), percent change, discount, tip with split, and tax add or extract',
      'Every result is shown with the formula that produced it — you can check the math on sight',
      'Discount mode names the saved amount, tip mode splits the bill per person, tax mode extracts tax from a gross price as well as adding it',
      'Percent change says "increase" or "decrease" explicitly and handles negative start values honestly',
      'One-tap copy on each answer, live computation as you type, nothing stored anywhere',
      'Runs entirely in this tab — there is no upload on the page',
    ],
    howItWorks: [
      'Pick the mode that matches your question — each one labels its inputs in plain words',
      'Type the numbers; the answer and the formula behind it appear immediately',
      'Copy any result with one tap, or switch modes — the page is the whole toolkit',
    ],
  },
  {
    id: 'date-calculator',
    name: 'Date Math Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Age in years, months and days, date differences, add or subtract time, business days and a live countdown — calendar-exact, computed on this device.',
    description:
      'The four date questions everyone asks, answered with real calendar arithmetic rather than day counts rounded by hand. Age mode counts years, months and days from a birth date, adds totals in weeks, months, hours and minutes, and counts down to the next birthday. Difference mode measures the span between two dates with an exclude-end-day toggle (the "both the start and the end?" question settled). Add/Subtract shifts a date by years, months, weeks and days with correct month-end clamping — Jan 31 plus one month is Feb 28/29, not a phantom March 3rd. Business days counts working days between dates and can add or subtract working days. Countdown ticks live toward any future date. Local dates throughout — no UTC parsing traps, invalid dates like Feb 30 are named on entry.',
    icon: 'calendar-days',
    intents: [
      'age calculator',
      'date difference calculator',
      'days between dates',
      'days until calculator',
      'business days calculator',
      'add days to date',
      'how many days until',
      'date duration calculator',
    ],
    features: [
      'Age mode: exact years/months/days, totals in weeks and months, hours-and-minutes precision, and a next-birthday countdown',
      'Difference mode with an exclude-end-day toggle and the same Y/M/D breakdown plus weekday of both endpoints',
      'Add/Subtract with real month-end clamping — Jan 31 + 1 month lands on Feb 28/29, not March 3rd',
      'Business days: working days between two dates, or add/subtract N working days, weekends excluded and counted honestly',
      'A live ticking countdown to any future date, updating every second',
      'Local-timezone dates, constructed day-by-day — no UTC off-by-one, and impossible dates are rejected with a message',
    ],
    howItWorks: [
      'Pick the mode: age, difference, add/subtract, business days or countdown',
      'Enter the dates (date pickers or typing) — results recompute instantly with the breakdown you need',
      'Read the exact units you care about — years/months/days, total days, working days — each labeled',
    ],
  },
  {
    id: 'bmi',
    name: 'Body Metrics Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'BMI with honest WHO bands, BMR and calorie targets, ideal-weight ranges and a Navy body-fat estimate — standard formulas, stated openly, nothing leaves the page.',
    description:
      'Four body metrics that are searched a hundred times a day, computed with the published formulas and labeled with what they honestly are. BMI (metric or imperial) with the WHO classification band and the weight range that would put you in the healthy band. BMR by the Mifflin-St Jeor equation, extended through five activity multipliers into TDEE and calorie targets for maintain, mild loss, loss and gain. Ideal weight by Robinson, Miller, Devine and Hamwi side by side, because they disagree and you should see that. Body fat by the US Navy circumference method and the Deurenberg BMI-based estimate, each named as the estimate it is. Every result carries the formula and an explicit note that these are population estimates, not a diagnosis — computed here, in this tab, and sent nowhere.',
    icon: 'heart-pulse',
    intents: [
      'bmi calculator',
      'calorie calculator',
      'bmr calculator',
      'tdee calculator',
      'ideal weight calculator',
      'body fat calculator',
      'how many calories to lose weight',
      'healthy weight for my height',
    ],
    features: [
      'BMI in metric (kg/cm) or imperial (lb/ft+in) with the WHO band named and the healthy weight range for your height',
      'BMR via Mifflin-St Jeor, scaled through five honest activity levels into TDEE and four calorie targets (maintain, −250, −500, +250)',
      'Ideal weight by Robinson, Miller, Devine and Hamwi shown side by side — they disagree, and seeing that is the point',
      'Body fat: US Navy circumference method (neck/waist/hip) plus the Deurenberg BMI estimate, each labeled an estimate',
      'Every number shows its formula in plain words; a standing note says these are population estimates, not medical advice',
      'Computed entirely in this tab — no account, no upload, nothing stored',
    ],
    howItWorks: [
      'Pick metric or imperial and enter height, weight, age and sex — BMI and BMR appear immediately',
      'Add neck/waist (and hip) measurements for the Navy body-fat estimate, or read the BMI-based one',
      'Read the calorie targets for your chosen activity level and copy the summary you need',
    ],
  },
  {
    id: 'loan',
    name: 'Loan & Interest Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'EMI and mortgage payments with the full amortization schedule, compound-interest projections and a savings-goal planner — exact math, exportable, computed locally.',
    description:
      'The three money questions behind "loan calculator" searches, answered with the real formulas and nothing hidden. Loan mode computes the monthly payment (EMI) from amount, rate and term, then builds the complete month-by-month amortization schedule — interest vs principal split, running balance — with an optional extra monthly payment that shows the months and interest it saves. Compound mode projects a principal plus regular monthly contributions at a chosen compounding frequency (annual, monthly, daily) with a year-by-year table. Goal mode works backwards: target amount, horizon and rate become the required monthly contribution. The amortization schedule and the projection table both export as CSV, and every number is computed in this tab — no quote service, no data collection.',
    icon: 'landmark',
    intents: [
      'loan calculator',
      'emi calculator',
      'mortgage payment calculator',
      'amortization schedule',
      'compound interest calculator',
      'savings goal calculator',
      'monthly payment calculator',
      'car loan calculator',
    ],
    features: [
      'Loan mode: monthly EMI from amount, annual rate and term, with total interest and total cost shown before you commit to anything',
      'Full amortization schedule — every month’s interest, principal and balance — with an optional extra-payment field that names the months and interest saved',
      'Compound mode: principal plus monthly contributions, annual/monthly/daily compounding, year-by-year growth table',
      'Goal mode: the required monthly contribution for a target amount on a fixed horizon, computed backwards through the same math',
      'CSV export for the amortization schedule and the projection table — your own spreadsheet, not a screenshot',
      'Everything is computed in this tab from the numbers you type; there is no form to submit and nothing to leak',
    ],
    howItWorks: [
      'Choose loan, compound or goal; type the amount, rate and term — the headline numbers appear immediately',
      'Open the schedule to read month-by-month interest and principal, or add an extra payment to see the savings',
      'Download either table as CSV for your own records',
    ],
  },
  {
    id: 'timer',
    name: 'Timer Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Stopwatch with laps, countdown with alarm, pomodoro and tabata intervals — timestamp-accurate even in a throttled tab, beeping locally.',
    description:
      'Four timers people open a browser for, one page, all driven by performance.now() timestamps instead of interval counters — so a throttled background tab still ends on time, which is the difference between a real timer and a toy. The stopwatch takes split laps with per-lap and total columns. The countdown takes any h:m:s plus one-tap presets, beeps through WebAudio when it hits zero (no audio file, no network), flashes the display, loops optionally and can repeat its alarm until dismissed. Pomodoro runs configurable work/short-break/long-break phases with automatic cycling and a session counter. Tabata runs prepare/work/rest cycles with configurable durations and rounds. A wake-lock is requested while running so phones keep the screen on, and the page title mirrors the clock so a glance at the tab bar is enough.',
    icon: 'timer',
    intents: [
      'online timer',
      'online stopwatch',
      'pomodoro timer',
      'countdown timer online',
      'interval timer',
      'tabata timer',
      'lap timer online',
      'kitchen timer online',
    ],
    features: [
      'Stopwatch with unlimited laps — split and total columns, tenth-of-a-second precision from performance.now()',
      'Countdown with h:m:s input, presets, WebAudio alarm (looped until dismissed), display flash and an optional auto-restart',
      'Pomodoro with configurable work/short/long lengths, automatic phase cycling and a completed-round counter',
      'Tabata with prepare, work and rest durations and round count, current phase shown big',
      'Timestamp-driven clocks: background-tab throttling cannot make it drift or stall',
      'Screen wake-lock while running, live tab-title countdown, everything local — the alarm plays from this device',
    ],
    howItWorks: [
      'Pick the timer: stopwatch, countdown, pomodoro or tabata',
      'Set what it needs (duration, rounds, phases) and start — the tab title and the big display carry the clock',
      'Leave the tab open; an alarm beeps locally when a countdown or phase ends, and laps/rounds are listed as they happen',
    ],
  },
  {
    id: 'picker',
    name: 'Random Picker Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Wheel of names, crypto-random numbers, coin flips, dice, list shuffles and fair team splits — real randomness on this device, no server draw.',
    description:
      'Every "pick for me" tool people search for, sharing one crypto-grade randomness source. The wheel of names spins an actual canvas wheel with momentum and a tick-per-segment result, with an optional remove-winner for successive draws. Numbers mode draws between any bounds with a unique-draws option for raffles. Coin flips and dice rolls (any count, d4 through d20 and custom) animate briefly and land on crypto.getRandomValues output — not Math.random. The shuffle mode Fisher-Yates your list, and pick-k extracts a random subset. Groups mode deals names into balanced teams. A result history runs down the side, and the wheel, the draws and the teams all come from the same honest source: nothing is picked on a server, nothing is rigged, nothing is remembered after you close the tab.',
    icon: 'shuffle',
    intents: [
      'wheel of names',
      'random name picker',
      'random number generator',
      'coin flip online',
      'dice roller online',
      'random team generator',
      'list randomizer',
      'raffle picker online',
    ],
    features: [
      'Wheel of names: canvas wheel, real spin with easing, one entry per line, remove-winner mode for successive draws',
      'Numbers between any bounds (negatives included), with a unique-draws raffle mode and sorted output option',
      'Coin flip and dice: n dice of d4–d20 or a custom side count, animated roll, individual results and total',
      'List shuffle (Fisher-Yates) and pick-k random subset from any pasted list',
      'Team splitter that deals names into n balanced groups and names them',
      'All randomness from crypto.getRandomValues, all history local, nothing sent or stored',
    ],
    howItWorks: [
      'Pick the mode and load your entries — paste a list for the wheel, shuffle or teams, or set bounds for numbers',
      'Spin, roll or split; the result animates and lands, and the winner (or teams) is announced',
      'Draw again — with remove-winner on, the wheel re-balances after each prize',
    ],
  },
  {
    id: 'regex',
    name: 'Regex Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Live JavaScript regex testing with highlighted matches, group tables, replace preview and a pattern library — safe-guarded, entirely local.',
    description:
      'A regex workbench that behaves like the real engine, because it IS the real engine. Type a pattern, tick flags (g, i, m, s, u, y), paste your test string, and every match is highlighted in place with a full table: index, matched text, capture groups and named groups. The replace tab previews String.replace with your replacement (including $1 backreferences) before you paste the pattern into real code. A pattern library seeds common jobs — e-mail, URL, ISO date, hex color, IPv4, duplicate words — and a cheatsheet keeps the syntax honest. Two safety nets matter: invalid patterns are caught and explained rather than crashing the page, and zero-length matches are advanced past explicitly so a /a*/g pattern cannot hang the tab in an infinite loop. Nothing is sent anywhere: your logs, your tokens, your data stay in this tab.',
    icon: 'regex',
    intents: [
      'regex tester',
      'regex online',
      'regular expression tester',
      'regex capture groups',
      'regex replace online',
      'test regex javascript',
      'regex cheat sheet',
    ],
    features: [
      'Live testing against the actual JavaScript RegExp engine with g, i, m, s, u and y flag toggles',
      'Every match highlighted in place in the test string, plus a table of index, match, capture groups and named groups',
      'Replace preview: String.replace semantics with $1/$<name> backreferences shown before you ship the pattern',
      'Pattern library (e-mail, URL, ISO date, hex color, IPv4, duplicate words, HTML tags) and a syntax cheatsheet',
      'Safety-guarded: invalid patterns get a readable error, and zero-length matches are stepped past so /a*/g cannot hang the page',
      'Entirely local — paste logs, tokens or customer rows here and nothing leaves the tab',
    ],
    howItWorks: [
      'Type the pattern, tick the flags you need and paste the test string — matches highlight immediately',
      'Read the match table for capture and named groups, or open the Replace tab and preview the substitution',
      'Grab a starting pattern from the library, or clear the flags and iterate until it matches exactly what you mean',
    ],
  },
  {
    id: 'csv',
    name: 'CSV & JSON Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'CSV to JSON and back with a real RFC 4180 parser — quoted fields, CRLF, any delimiter, type inference, malformed-quote warnings — all in this tab.',
    description:
      'The conversion behind half of all spreadsheet-and-API work, done properly instead of with split(","). A real RFC 4180 parser handles quoted fields, escaped quotes, embedded commas and newlines, CRLF endings and your choice of delimiter (comma, semicolon, tab, pipe) — and it warns honestly about unclosed quotes instead of silently mangling the row. CSV→JSON uses your header row as keys (or index keys when there is none), with optional type inference turning "42" into 42 and "true" into true. JSON→CSV flattens an array of objects across the union of all keys, stringifying nested values so nothing is dropped. A table viewer shows the parsed grid before you commit, and both directions export: download the JSON, download the CSV, copy either. Files, pastes and conversions never leave this tab.',
    icon: 'file-spreadsheet',
    intents: [
      'csv to json',
      'json to csv',
      'csv converter online',
      'csv viewer online',
      'csv parser online',
      'excel csv to json',
      'json array to csv',
      'tsv to json',
    ],
    features: [
      'Real RFC 4180 parser: quoted fields, escaped quotes, embedded commas and newlines, CRLF, and unclosed-quote warnings that name the row',
      'Delimiter choice — comma, semicolon, tab or pipe — for European exports and TSVs alike',
      'CSV→JSON with header-as-keys or index keys and optional type inference (numbers, booleans, null)',
      'JSON→CSV across the union of all object keys, nested values JSON-stringified so no field is silently dropped',
      'Table viewer of the parsed grid before export, with row and column counts',
      'Copy or download the result as .json / .csv — the whole conversion happens in this tab',
    ],
    howItWorks: [
      'Paste or drop your CSV or JSON and pick the direction — the parsed table appears immediately',
      'Adjust the delimiter and header handling until the grid reads right; warnings point at any malformed rows',
      'Copy or download the converted output as JSON or CSV',
    ],
  },
  {
    id: 'color',
    name: 'Color Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Pick, convert and check colors: eyedropper and image sampling, HEX/RGB/HSL with alpha, WCAG contrast testing and ready palettes — computed on this device.',
    description:
      'The color chores behind "hex to rgb" and "color contrast checker" searches, one page. Convert mode accepts anything — #ff7a45, rgb(255 122 69), hsl(18 100% 64%), 8-digit hex with alpha — and answers in every format at once, each with a copy button and a live swatch. Pick mode samples colors from any image you drop (hover to inspect, click to commit) and uses the browser’s EyeDropper API where it exists, so you can sample the screen itself. Contrast mode tests two colors against WCAG 2.1: the exact ratio, the AA and AAA verdicts for normal and large text, both color orders. Palette mode builds tints and shades ramps and the classic harmonies (complementary, analogous, triadic) from any base via real HSL math. Every value is computed in this tab; no image is uploaded to sample it.',
    icon: 'palette',
    intents: [
      'color picker online',
      'hex to rgb',
      'rgb to hex converter',
      'hsl to hex',
      'color contrast checker',
      'wcag contrast checker',
      'color palette generator',
      'eyedropper online',
    ],
    features: [
      'Convert anything — 3/4/6/8-digit hex, rgb()/rgba(), hsl()/hsla(), plain components — into every format at once, alpha included',
      'Pick from an image you drop on the page (hover inspect, click commit) or from the screen itself via the EyeDropper API where the browser offers it',
      'WCAG 2.1 contrast testing: exact ratio, AA/AAA verdicts for normal and large text, both foreground/background orders',
      'Palette studio: 9-step tint and shade ramps plus complementary, analogous and triadic harmonies from any base color',
      'One-tap copy on every value, live swatches, and honest notes where a browser feature (EyeDropper) is unavailable',
      'Images you sample stay in this tab — there is no upload anywhere on the page',
    ],
    howItWorks: [
      'Type or paste a color in any format — the full conversion table and swatch update as you type',
      'Drop an image to sample from it (or use the screen eyedropper where supported); commits become the working color',
      'Test it against a background for WCAG contrast, then copy the palette values you need',
    ],
  },
  {
    id: 'signature',
    name: 'Signature Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Draw or type a signature and download it as a transparent PNG, trimmed and sized for documents — drawn in this tab, uploaded nowhere.',
    description:
      'The two ways people put a signature into a PDF or email, done honestly on one page. Draw mode is a real pressure-aware canvas with a baseline guide, pen width and color controls, stroke-by-stroke undo and a clear — the way you sign paper, not a fingerprint smudge on a trackpad. Type mode renders your name in five handwriting-style faces with size and slant controls, because some people simply prefer typed. Both modes export a transparent-background PNG trimmed to the ink bounds with padding, at the width you pick (400/600/800 px), so the file drops into a document without a white box around it. Everything renders on a local canvas; nothing is transmitted, stored or fingerprinted.',
    icon: 'signature',
    intents: [
      'signature generator',
      'signature maker online free',
      'draw signature online',
      'typed signature generator',
      'signature to png transparent',
      'e signature create',
      'handwritten signature download',
      'signature pad online',
    ],
    features: [
      'Draw mode: pointer-event canvas that works with mouse, trackpad, touch and stylus pen, with pressure giving natural width variation where the hardware reports it',
      'Stroke-by-stroke undo and clear, a guide baseline that never exports, and a replay-free flat export — what you see is exactly the PNG',
      'Type mode: five handwriting-style faces, adjustable size and slant, rendered through canvas so it exports identically everywhere',
      'Transparent background by default, with a checkerboard preview that shows the transparency honestly',
      'Trim-to-ink export: the PNG is cropped to the actual signature bounds with padding, so it sits in a document without dead space',
      'One-tap download at 400/600/800 px width — and the canvas never leaves this tab',
    ],
    howItWorks: [
      'Pick Draw or Type; draw with the mouse or finger, or type your name and pick a handwriting face',
      'Adjust pen width or font size until the preview looks right; undo removes your last stroke',
      'Choose the export width and press Download PNG — a trimmed, transparent file lands in your downloads',
    ],
  },
  {
    id: 'invoice',
    name: 'Invoice Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Build a clean invoice with line items, tax, discount and shipping, then print or save it as a PDF from the browser dialog — no account, nothing stored.',
    description:
      'The invoice a freelancer or small business actually needs, without a SaaS signup: seller and buyer blocks, invoice number and dates, line items with quantity and unit rate, a discount that can be a percent or a flat amount, tax applied after the discount (the order that matters and that most cheap calculators get wrong), shipping, notes and payment terms. The preview on the right is the real printable document — the Print button opens the browser dialog and the page CSS prints only the invoice sheet, which is also how "save as PDF" works. Every figure recomputes live and the math is shown: subtotal, discount, taxable base, tax, shipping, total. The invoice is composed in this tab and printed by this tab; no server ever sees it.',
    icon: 'receipt',
    intents: [
      'invoice generator',
      'free invoice maker',
      'invoice template printable',
      'invoice generator no signup',
      'small business invoice',
      'freelance invoice generator',
      'pdf invoice maker',
      'invoice with tax and discount',
    ],
    features: [
      'Line items with description, quantity and unit rate; add and remove rows freely',
      'Discount as percent or flat amount, tax computed on the post-discount base (the correct order), shipping on top',
      'Currency symbol selector (incl. ₹, ¥, €, £ and a custom field) applied consistently across the sheet',
      'Live printable preview that is the real document — print CSS hides everything but the invoice sheet',
      'Invoice number, issue and due dates, notes and payment terms fields that all make it into the print',
      'Print → Save as PDF from the browser dialog gives a PDF without any upload; the math breakdown stays visible on screen',
    ],
    howItWorks: [
      'Fill seller, buyer, number and dates; add line items with quantity and rate',
      'Set discount, tax, shipping and notes — the preview and the math breakdown update as you type',
      'Press Print invoice and choose your printer, or "Save as PDF" in the same dialog',
    ],
  },
  {
    id: 'timezone',
    name: 'Time Zone Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Convert a time across zones, keep a live world clock, and read a meeting-planner strip that shows working-hour overlap — powered by the Intl database, computed locally.',
    description:
      'The three "what time is it in…" jobs on one page. Convert mode translates one date-time from any zone to any set of zones and names the day shift explicitly — "next day" and "previous day" badges, because a 9 PM call to Tokyo is tomorrow and pretending otherwise misses flights. World clock mode keeps live-ticking cards for the zones you pick, each with its offset from UTC and from your own zone. Meeting planner mode lays out the 24-hour strip for up to three zones, colors each hour green, amber or red against that zone\u2019s working hours, and computes the overlap windows where everyone is awake and at work. All zone data comes from the browser\u2019s own Intl database — the same IANA names every OS ships — so there is no stale timezone table baked into the page.',
    icon: 'globe',
    intents: [
      'time zone converter',
      'world clock',
      'meeting time planner',
      'time converter between cities',
      'what time is it in',
      'timezone difference calculator',
      'utc converter',
      'best time to call across time zones',
    ],
    features: [
      'Convert one date-time to any number of target zones with next-day / previous-day badges and per-zone offsets',
      'Live world clock cards that tick every second, with the offset from UTC and from your local zone spelled out',
      'Meeting planner strip: 24 hours × up to three zones, green / amber / red against configurable working hours, your-now column marked',
      'Best-overlap rows that name the hour ranges where all chosen zones sit inside working hours',
      'Zone picker uses the browser\u2019s Intl IANA list (400+ zones) with your local zone pre-selected',
      'Every computation runs on this device against the OS zone database — nothing is queried, nothing is stored',
    ],
    howItWorks: [
      'Convert: pick a source zone and time, add the cities you care about, read the rows',
      'World clock: add zones and leave the page open — the cards tick live',
      'Planner: set working hours once, add up to three zones, read the colored strip and the overlap window',
    ],
  },
  {
    id: 'pdf-to-image',
    name: 'PDF to Image Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Render every PDF page to PNG or JPG at 1×, 2× or 3× scale, preview each one, download a page or the whole set as a ZIP — rendered by pdf.js on this device.',
    description:
      'The reverse of images-to-PDF and the honest way to get pictures out of a document: the same pdf.js engine Firefox uses renders each page to a canvas at the scale you pick (1× ≈ 72 dpi screen, 2× and 3× for print work), and the page exports as PNG (lossless) or JPG with a quality slider. Every page gets a live thumbnail in a grid before you commit; download one page or pack the whole run into a ZIP named after the file. Pages render sequentially with a visible progress count, so a 100-page document does not freeze the tab — and the honest cap is memory, stated plainly when a very large file hits it. The PDF never leaves this device: it is read into this tab\u2019s memory, rasterized here, and written back out as downloads.',
    icon: 'file-image',
    intents: [
      'pdf to image',
      'pdf to png converter',
      'pdf to jpg online free',
      'convert pdf pages to images',
      'pdf page screenshot',
      'pdf to png high resolution',
      'export pdf as images',
      'pdf to zip images',
    ],
    features: [
      'Full-page rasterization with pdf.js — the same renderer Firefox ships — not a screenshot hack',
      'Scale choice 1× / 2× / 3× (roughly 72 / 144 / 216 dpi) so print-quality exports are one click away',
      'PNG for lossless text-and-diagram pages, JPG with a quality slider for scanned photo pages',
      'Grid of live page thumbnails before export; grab one page or the whole set as a ZIP',
      'Sequential rendering with a page-by-page progress count and an honest memory note instead of a silent hang',
      'Nothing uploads: the file is parsed, rendered and exported inside this tab',
    ],
    howItWorks: [
      'Drop a PDF — the page grid fills as each page renders at your chosen scale',
      'Switch PNG/JPG and scale any time; re-render applies the new settings to all pages',
      'Download a single page, or press Download all as ZIP for the complete run',
    ],
  },
  {
    id: 'device-test',
    name: 'Device Check Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Test your camera and microphone before the real call: resolution and FPS readouts, live level meters, full device info — nothing is recorded, nothing is sent.',
    description:
      'The pre-call check Zoom never made easy, split into three honest panels. Camera test starts your webcam, reports the track\u2019s real resolution and frame-rate setting, then measures the actual delivered FPS over a two-second window instead of trusting the promise — and lists every camera so you can switch devices without leaving the page. Microphone test opens your mic, runs a WebAudio level meter with an RMS bar and a peak-hold marker, and reports the sample rate; speak and watch the bar move. Device info reads the screen, pixel ratio, CPU cores, memory hint, touch support, language, timezone and browser capabilities into one card you can copy for a support ticket. There is no recording code on this page — no MediaRecorder anywhere — and every stream is stopped the moment you close a panel.',
    icon: 'webcam',
    intents: [
      'webcam test',
      'camera test online',
      'microphone test online',
      'mic level meter',
      'test my camera and mic',
      'check camera resolution fps',
      'is my webcam working',
      'device info checker',
    ],
    features: [
      'Camera test with live preview, the track\u2019s resolution and frame-rate settings, and a measured-FPS counter that reflects reality',
      'Device enumeration and in-page switching between cameras (front / back on phones, multiple webcams on desktops)',
      'Microphone test with an RMS level bar, peak-hold marker and sample-rate readout from the WebAudio analyser',
      'Device info card: screen, DPR, CPU cores, memory hint, touch, languages, timezone, browser — with one-tap copy',
      'Honest permission states: a denied camera or mic is explained with how to unblock it, not a silent black box',
      'Nothing recorded, nothing uploaded: there is no MediaRecorder on this page and every track stops when you close the panel',
    ],
    howItWorks: [
      'Press Start camera test or Start microphone test and grant the permission when the browser asks',
      'Watch the meters; switch cameras from the dropdown, or re-run after changing settings',
      'Copy the device info card for a support ticket; close the panel to stop the stream',
    ],
  },
  {
    id: 'beautify',
    name: 'Code Formatter Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Format and compact HTML, CSS and SQL with real engines (js-beautify, sql-formatter), validate JSON along the way — minified output stays honest about what it preserves.',
    description:
      'The paste-it-and-make-it-readable page, running four real formatter engines in this tab. HTML, CSS and JS go through js-beautify — the library behind browser devtools and jsfiddle — with indent size, wrap width and quote-style controls; SQL goes through sql-formatter with dialect choice (Standard, MySQL, PostgreSQL, T-SQL, PL/SQL) and keyword casing. The compact modes are honest about their limits: CSS and SQL minify by stripping comments and collapsing whitespace (spaces inside calc() and between keywords are preserved, because removing them changes meaning), HTML minify drops comments and inter-tag whitespace while leaving pre, textarea, script and style contents byte-exact, and JS deliberately ships a beautifier only — whitespace-stripping JavaScript minifiers break automatic-semicolon-insertion, and a page that pretends otherwise ships broken code. A JSON side-check with exact error line and column rounds out the toolkit. Nothing leaves the device.',
    icon: 'file-code',
    intents: [
      'json formatter',
      'html formatter online',
      'css beautifier',
      'sql formatter',
      'js beautifier online',
      'minify css online',
      'format code online free',
      'sql query beautifier',
    ],
    features: [
      'Real engines: js-beautify for HTML/CSS/JS, sql-formatter with five SQL dialects — not regex pretending',
      'Indent size (2/4/tab), wrap width and quote-style controls that actually reach the engine',
      'Honest compaction: CSS/SQL comment-and-whitespace strip with calc()-safe spacing, HTML minify that never touches pre/textarea/script/style bytes',
      'No JS minify, on principle: ASI makes whitespace-stripping unsafe, and the page says so instead of shipping a footgun',
      'JSON side-check with the exact line and column of any parse error',
      'Input auto-detected by content, switchable by hand; output copies with one tap or downloads as a file',
    ],
    howItWorks: [
      'Paste your code — the formatter runs live and the output panel updates as you type',
      'Tune indent, wrap and dialect in the options row; flip Beautify / Compact as needed',
      'Copy or download the result; use the JSON tab to pin down exactly where a parse error lives',
    ],
  },
  {
    id: 'favicon',
    name: 'Favicon Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'One image becomes the whole favicon set: 16 to 512 px PNGs, a real multi-size .ico, an apple-touch icon and the HTML snippet — packed as a ZIP, generated on this device.',
    description:
      'What "add a favicon" actually requires, done in one drop: a source image is resized to every size a modern site references — 16, 32, 48, 64, 96, 128, 180 (apple-touch), 192 and 512 (PWA manifest) — plus a genuine .ico container holding the 16/32/48 trio, built byte-by-byte to the ICO spec rather than renamed. Fit is your choice: cover center-crops to fill the square, contain letterboxes with a background color you pick (with a rounded-corner mask option for the tile look). Every generated size is previewed at true pixel size on both light and dark chips, because a logo that dies at 16 px should die in preview, not in production. Downloads come per-size or as one favicon-pack ZIP, and the exact <link> tags to paste into your HTML are generated with the filenames matching the ZIP contents.',
    icon: 'image-down',
    intents: [
      'favicon generator',
      'favicon from image',
      'create favicon ico',
      'favicon pack all sizes',
      'apple touch icon generator',
      'convert png to ico',
      'website icon generator',
      'favicon 16x16 32x32 download',
    ],
    features: [
      'Every size a site references in one pass: 16, 32, 48, 64, 96, 128, 180, 192 and 512 px PNGs',
      'A real .ico file built to the ICO container spec with embedded 16/32/48 PNG entries — not a renamed PNG',
      'Cover (center-crop) or contain (letterbox with your background color) fitting, plus an optional rounded-corner mask',
      'True-size previews on light and dark chips at every size, so 16 px legibility is judged before you ship',
      'The copy-paste <link> HTML block, with filenames matching the ZIP exactly',
      'Per-size downloads or one favicon-pack ZIP — every pixel produced on this device',
    ],
    howItWorks: [
      'Drop one square-ish image; choose cover or contain fit and, for contain, a background color',
      'Check the true-size previews — especially 16 px — and toggle the rounded mask if you want the tile look',
      'Download the ZIP (or a single size), paste the generated <link> tags, ship the folder as-is',
    ],
  },
  {
    id: 'watermark',
    name: 'Watermark Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Stamp text or a logo onto a batch of photos — position, opacity, rotation and tiling — and download the watermarked set as a ZIP, entirely on this device.',
    description:
      'The batch watermark photographers and agencies actually want, without shipping the originals to a stranger\u2019s server. Drop one image or fifty; watermark them with styled text (content, font size relative to the image, color, opacity, rotation, any of the nine positions with a margin, or a diagonal tile grid) or with your own logo image (scale, opacity, position, margin, tiling). A live preview renders the first image with your settings before you commit the batch. Export keeps each file\u2019s format — JPEG stays JPEG at a quality you set, PNG stays PNG with its alpha — and the watermarked set downloads individually or as one ZIP. The canvas work happens per image in this tab; the originals and the outputs never leave the device.',
    icon: 'stamp',
    intents: [
      'watermark photos online free',
      'add watermark to images',
      'batch photo watermark',
      'logo watermark maker',
      'text watermark generator',
      'watermark multiple images at once',
      'photo copyright watermark',
      'tile watermark on images',
    ],
    features: [
      'Text watermark: content, size scaled to the image, color, opacity, rotation, nine-position grid with margin, or diagonal tile mode',
      'Logo watermark: use your own PNG/SVG-style image with scale, opacity, position, margin and tiling',
      'Batch honest: the preview shows image one at full settings, then the same stamping runs across every file',
      'Format-faithful export — JPEG in, JPEG out with a quality slider; PNG in, PNG out with alpha preserved',
      'Per-image downloads or one ZIP of the whole watermarked run, named originalname.watermarked.ext',
      'Nothing uploads: the images are drawn, stamped and exported inside this tab',
    ],
    howItWorks: [
      'Drop images; pick text or logo mode and set content, size, opacity, position (or tiling)',
      'Check the live preview on the first image; adjust until it reads well at small sizes',
      'Apply to the batch, then download files individually or as one ZIP',
    ],
  },
  {
    id: 'typing-test',
    name: 'Typing Test Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Measure real WPM, CPM and accuracy over 15, 30, 60 or 180 seconds on a live word stream — the clock starts on your first keystroke, computed on this device.',
    description:
      'The typing-speed test done the way the numbers are actually defined. A stream of common English words renders with per-word coloring: typed-correct words go solid, the active word shows character-by-character what is right and wrong, mistakes count the standard way (uncorrected errors count against accuracy, and the test never silently "fixes" a wrong word). The timer starts on your first keystroke — not on page load — and runs 15 seconds, 30, one minute or three; WPM is (correct characters ÷ 5) ÷ minutes and CPM is the raw character count, both recomputed live and shown with the final accuracy, character tally and consistency. Results carry a restart and a new-word-stream button, and a personal best for the session lives in the tab only. The word list, the timer and the math all run here; no account, no leaderboard, nothing submitted.',
    icon: 'keyboard',
    intents: [
      'typing test',
      'wpm test',
      'typing speed test free',
      'words per minute test',
      'typing practice online',
      'cpm typing test',
      '1 minute typing test',
      'typing accuracy test',
    ],
    features: [
      'Durations 15s / 30s / 1m / 3m, and the clock starts on your first keystroke, not on page load',
      'Per-character coloring in the active word — what is right, what is wrong, what is extra',
      'Honest scoring: WPM = correct chars ÷ 5 ÷ minutes, CPM = raw chars, accuracy from uncorrected errors, consistency from keystroke variance',
      'A stream of common English words generated locally; new stream on demand, no network word API',
      'Live timer bar and counters, auto-finish at zero with a full results card and one-tap restart',
      'Session best kept in the tab only — no leaderboard, no account, nothing leaves the device',
    ],
    howItWorks: [
      'Pick a duration and start typing in the box — the test begins with your first letter',
      'Type the highlighted stream; wrong characters color red immediately and count unless corrected',
      'When the clock ends, read WPM, CPM, accuracy and consistency, then restart or extend the time',
    ],
  },
  {
    id: 'markdown',
    name: 'Markdown Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Write Markdown with a live preview, a table generator and clean HTML export — rendered by a built-in engine that escapes raw HTML by default.',
    description:
      'A Markdown workbench for READMEs, blog drafts and documentation: the editor sits beside a live preview rendered by a built-in engine covering what people actually write — headings through h6, bold, italic, strikethrough, inline code and fenced code blocks with a language label, links and images, blockquotes, horizontal rules, ordered and unordered lists with nesting, and GFM tables with alignment. Raw HTML is escaped by default — pasted <script> renders as text, which is the safe default for a tool you paste other people\u2019s text into — with an explicit allow-HTML switch when you genuinely want it. The table generator builds aligned GFM tables from a rows × columns grid so the syntax nobody remembers is one click. Exports: standalone HTML (a complete styled document, not a fragment), raw HTML, or the Markdown itself; stats for words, characters and lines update live. Everything renders in this tab.',
    icon: 'file-text',
    intents: [
      'markdown editor online',
      'markdown to html',
      'markdown preview live',
      'markdown table generator',
      'gfm editor online',
      'markdown converter free',
      'write markdown online',
      'md to html converter',
    ],
    features: [
      'Live split view: editor left, rendered preview right, synchronized scroll kept sane and re-rendered on every keystroke',
      'Real Markdown subset: h1–h6, emphasis, strike, inline and fenced code, links, images, quotes, rules, nested lists, GFM tables with alignment',
      'Safe by default — raw HTML is escaped and shown as text, with an explicit allow-HTML toggle that states the trade-off',
      'Table generator: rows × columns grid emits an aligned GFM table, inserted or copied',
      'Exports: standalone styled HTML document, raw HTML fragment, or the .md source — all one click',
      'Word, character and line counts update live; every render happens on this device',
    ],
    howItWorks: [
      'Type Markdown on the left — the preview renders as you type; the sample document shows the syntax working',
      'Build a table with the generator when the pipes get tedious, and toggle allow-HTML only when you mean it',
      'Copy or download the HTML (standalone or fragment) or the Markdown source',
    ],
  },
  {
    id: 'stats',
    name: 'Statistics Calculator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Mean, median, mode, range, variance, standard deviation, quartiles and outliers from pasted numbers — computed live on this device, both sample and population flavors.',
    description:
      'Paste numbers in any format — one per line, comma, space or tab separated, with junk words skipped and counted — and every standard descriptive statistic recomputes as you type. Central tendency: mean, median (50th percentile by linear interpolation, the same method as Excel PERCENTILE.INC and numpy), and an honest mode that says "none" when every value occurs once instead of printing a zero. Spread: range, quartiles Q1/Q3 with the IQR, sample and population variance and standard deviation under the n−1 and n dividers you actually mean, plus the 1.5×IQR fences with the outliers named. A ten-bin histogram draws the distribution from the same data, the sorted list sits below for a check-by-eye, and every formula is written on the card that uses it.',
    icon: 'sigma',
    intents: [
      'mean median mode calculator',
      'standard deviation calculator',
      'statistics calculator online',
      'variance calculator',
      'quartile calculator iqr',
      'outlier calculator',
      'find mean of a list of numbers',
      'population vs sample std dev',
    ],
    features: [
      'Tolerant parsing: commas, spaces, tabs and newlines all work; non-numeric tokens are skipped and counted, never dropped silently',
      'Median and quartiles by linear interpolation — the same numbers Excel PERCENTILE.INC and numpy produce',
      'Sample (n−1) and population (n) variance and standard deviation, switchable, with the formula printed on the card',
      'Honest mode: "none" when every value occurs once, the tied values listed when the distribution is multi-modal',
      'Outliers by the 1.5×IQR rule with the fences shown, plus a ten-bin frequency histogram of the actual data',
      'The sorted list renders below for a by-eye check — everything recomputes on every keystroke',
    ],
    howItWorks: [
      'Paste or type your numbers in any layout — the count and skip report appear as you type',
      'Pick sample or population for the variance flavor; every card updates at once',
      'Read the stats, check the histogram and sorted list, and name your outliers from the fences',
    ],
  },
  {
    id: 'number-to-words',
    name: 'Number to Words',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Figures into words for cheques and contracts — "Rupees and paise", dollars and cents, lakh/crore or million/billion — with the cheque line ready to copy.',
    description:
      'The converter for the line a bank actually reads: type an amount and get the words — 1,23,456.78 → "Rupees one lakh twenty-three thousand four hundred fifty-six and seventy-eight paise only" in the Indian system, or the same figure as "one million two hundred thirty-four thousand five hundred sixty-seven dollars and eighty-nine cents" in the international short scale. Currencies: plain number, USD, EUR, GBP and INR, with the decimals rendered as cents, pence or paise and the trailing "only" the cheque format expects. Commas and currency symbols are stripped automatically, negatives are spoken as "minus", numbers past two decimals are cut — not rounded — with a note, because a cheque amount must never silently change value, and the ceiling is the JavaScript safe-integer maximum, stated rather than crashed into.',
    icon: 'banknote',
    intents: [
      'number to words',
      'amount in words for cheque',
      'rupees in words',
      'dollars in words converter',
      'numbers to words in indian system',
      'lakh crore number to words',
      'cheque amount in words online',
      'write amount in words converter',
    ],
    features: [
      'Two numbering systems: international short scale (thousand → million → billion) and Indian (thousand → lakh → crore → arab)',
      'Five framings: plain number, USD, EUR, GBP and INR — decimals become cents, pence or paise, and every money line ends in "only"',
      'Cheque-safe rounding policy: amounts past two decimal places are truncated with a visible note, never silently rounded',
      'Commas, currency symbols and stray spacing are stripped automatically; negatives are spoken as "minus"',
      'The honest ceiling: beyond the JavaScript safe-integer maximum (about 9 quadrillion) the page says so instead of hallucinating words',
      'Everything updates as you type, with the plain-words line underneath for double-checking the money line',
    ],
    howItWorks: [
      'Type the amount — commas and symbols are cleaned up automatically as the words appear',
      'Pick the numbering system and the currency framing the document needs',
      'Copy the cheque line, or read the plain words underneath to verify it digit by digit',
    ],
  },
  {
    id: 'morse',
    name: 'Morse Code Translator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Text ↔ Morse in one box — the direction is detected from what you type — with live audio playback, WPM speed and tone controls on the standard PARIS timing.',
    description:
      'A two-way Morse translator with the timing done properly. Type text and get ITU-standard Morse with letters spaced by one space and words by a slash; type dots and dashes and get text back — the tool detects which side of the conversation you are on. Playback sounds the message on a WebAudio sine oscillator scheduled entirely on the audio clock: dot = 1 unit, dash = 3, gaps of 1 / 3 / 7 units inside letters, between letters and between words, with the unit set by your chosen words-per-minute using the PARIS convention (unit = 1.2 ÷ WPM seconds) — 5 to 35 WPM and 300–1200 Hz, adjustable while you listen. A flashing element readout follows the audio beat. Characters with no Morse mapping are named on the page instead of vanishing, and nothing you type is stored or sent.',
    icon: 'waves',
    intents: [
      'morse code translator',
      'text to morse code',
      'morse code to english',
      'morse code audio player',
      'morse code generator with sound',
      'sos in morse code',
      'morse code alphabet chart',
      'morse translator with speed control',
    ],
    features: [
      'Both directions in one box: predominantly dots-dashes reads as Morse, anything else as text — no toggle to forget',
      'The full ITU table: A–Z, 0–9 and the punctuation set every guide expects, plus honest naming of unencodable characters',
      'Live audio on a WebAudio oscillator scheduled on the audio clock — tab throttling cannot bend the beat',
      'Standard timing by the PARIS convention: unit = 1.2 ÷ WPM seconds, dot 1, dash 3, gaps 1/3/7 — adjustable 5–35 WPM',
      'Tone frequency 300–1200 Hz so the pitch sits where your ear wants it, with click-free 5 ms envelope ramps',
      'A flashing dot/dash readout follows the playback for silent practice alongside (or instead of) the sound',
    ],
    howItWorks: [
      'Type either language — the direction badge tells you how the input was read',
      'Set speed and tone, press Play, and listen (or watch the flashing readout)',
      'Copy the output from the result box; unencodable characters are listed, never dropped in silence',
    ],
  },
  {
    id: 'font-changer',
    name: 'Font Changer',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Turn plain text into the Unicode styles bios and usernames use — bold, italic, script, fraktur, small caps, circled, fullwidth, upside-down — with honest limits named.',
    description:
      'Thirteen Unicode "styled alphabets" applied to whatever you type: bold and italic sans, bold italic, serif bold, script and bold script, fraktur, double-struck, monospace, small caps, circled, fullwidth and upside-down — the styles that paste into Instagram, X, Discord and anywhere else plain text is accepted, because they are characters, not installed fonts. Each style maps only the code points Unicode actually provides: digits are named per style (the mathematical blocks carry them for bold, serif, double-struck, monospace and circled, not the others), script and fraktur fill their reserved letters with the standard honorific substitutes, and any character a style cannot render stays as-is with the gap written on the card. The tool also says plainly what these are: a code-point trick, not a font — screen readers announce them strangely, and that is worth knowing before you put 𝐛𝐨𝐥𝐝 in a headline.',
    icon: 'case-sensitive',
    intents: [
      'font changer for instagram bio',
      'fancy text generator',
      'unicode font converter',
      'bold italic text generator',
      'small caps text generator',
      'aesthetic fonts copy paste',
      'strikethrough upside down text',
      'script font changer online',
    ],
    features: [
      'Thirteen styles live at once — every card updates as you type, each with a one-click copy',
      'Honest per-style coverage: digits mapped only where the Unicode block provides them, gaps listed on the card instead of hidden',
      'Script and fraktur honorifics (ℬ ℰ ℋ ℭ ℜ ℨ…) fill the reserved holes in the mathematical blocks the standard way',
      'Small caps, circled, fullwidth and upside-down built from explicit tables — the ragged coverage is visible, not pretended away',
      'Plain statement of what these are: Unicode code points, not fonts — with the screen-reader caveat written on the page',
      'Nothing leaves the tab: the mapping is a table on the page, applied character by character locally',
    ],
    howItWorks: [
      'Type the bio line or username — all thirteen styles render at once below',
      'Check the "no mapping for" note on a style before pasting it somewhere unforgiving',
      'Copy the style you want and paste it anywhere — the characters carry the style, not a font file',
    ],
  },
  {
    id: 'emoji',
    name: 'Emoji Finder',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Search hundreds of everyday emojis by name or keyword, grouped by category, click to copy — a built-in set, no network API, nothing tracked.',
    description:
      'A searchable emoji grid that runs entirely on a built-in dataset: every entry carries its common name and the keywords people actually type ("heart", "fire", "dog", "pizza", "sad"), organized into nine categories — smileys and hearts, people and gestures, animals and nature, food and drink, activity and music, travel and places, objects, symbols, flags. Search filters across names and keywords live as you type; category chips narrow the grid; a click copies the character to your clipboard and pins it to a Recently-copied row that lives in the tab only. The page states its honest scope: this is the everyday set with real search terms, not the full Unicode 16 catalog — which is exactly the trade a finder needs, because the useful question is "which one is the sad face", not "list all 3,700".',
    icon: 'smile',
    intents: [
      'emoji finder',
      'emoji search by keyword',
      'copy emoji online',
      'emoji list with names',
      'emoji picker online free',
      'find emoji by meaning',
      'emoji copy paste keyboard',
      'smiley face emoji list',
    ],
    features: [
      'A built-in dataset with real keywords per emoji — search matches how you think ("fire" finds 🔥, "sad" finds the whole row)',
      'Nine category chips: smileys, people, animals, food, activity, travel, objects, symbols, flags — or browse all',
      'Click to copy with a visible "copied" state; the Recently-copied row keeps the last twelve in tab memory only',
      'Zero network calls: the table ships on the page, so it works offline and tracks nothing',
      'Honest scope on the page: the everyday set, not the full Unicode catalog — stated in the empty state too',
      'Keyword hints under every tile, so the search terms you used are visible next to the characters',
    ],
    howItWorks: [
      'Type what you are looking for — "heart", "rocket", "cry" — or clear the search to browse a category',
      'Click any tile: the emoji is on your clipboard and pinned to Recently copied',
      'Paste anywhere; the recents row stays in this tab only and vanishes when you close it',
    ],
  },
  {
    id: 'json-to-ts',
    name: 'JSON to TypeScript',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Turn a JSON document into clean TypeScript interfaces — one per distinct object shape, array items singularized, sibling-absent fields marked optional.',
    description:
      'The generator that types JSON the way you would by hand. Paste any JSON (the sample shows the shape of the output) and get export-ed interfaces: every distinct object shape becomes one named type — identical shapes are re-used, never duplicated — nested objects are lifted out, array items get a singularized name (orders → Order), and fields that are missing, or null, in some members of an array come out optional everywhere in the tree, because "the API omits this sometimes" is exactly what `?` encodes. Switch between interfaces and type aliases, add the readonly prefix, rename the root, and copy the result. Parse errors carry line and column. Arrays of mixed types produce honest unions; empty arrays become unknown[] instead of a guessed type; primitive roots become one type alias. Generation is deterministic and local — the JSON never leaves the tab.',
    icon: 'file-json',
    intents: [
      'json to typescript',
      'json to interface converter',
      'json to ts online',
      'generate typescript types from json',
      'json to type alias',
      'json schema to typescript free',
      'api response to typescript',
      'json to typescript interface online',
    ],
    features: [
      'One interface per distinct object shape with structural dedup — repeated shapes are re-used, never emitted twice',
      'Optional fields done right: keys missing or null in some array members come out `?` everywhere in the tree',
      'Array items singularized (orders → Order, items → Item) and unions built for genuinely mixed arrays',
      'Interfaces or type aliases, optional readonly prefix, editable root name — the knobs people actually use',
      'Parse errors pinned to line and column, so a broken paste is fixable in one glance',
      'Deterministic generation on this device — the JSON is held in page memory and never submitted',
    ],
    howItWorks: [
      'Paste the JSON — the interfaces render instantly, with the sample document showing the conventions',
      'Adjust the root name, switch to type aliases or add readonly to match your codebase style',
      'Copy the module and drop it into your project; regenerate after the API changes shape',
    ],
  },
  {
    id: 'compress-pdf',
    name: 'PDF Compressor',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Shrink PDFs by rasterizing pages at your chosen scale and JPEG quality and rebuilding the file with pdf-lib — with an honest before/after verdict either way.',
    description:
      'The rasterization route, stated plainly: every page is rendered by pdf.js at a chosen scale (0.75× to 2×), encoded as JPEG at a chosen quality (30–95%), and the images are rebuilt into a fresh PDF at the original page size — genuinely shrinking scan-heavy and photo-heavy files, often by a lot. The page tells the truth in both directions: a vector-heavy file (text, line art) can come out LARGER, and the result card names that outcome instead of pretending, with the recommendation to keep the original. The honest cost is on the page before you run it: rasterized pages are images, so text stops being selectable and searchable. Page dimensions stay at the original print size regardless of render scale — only the pixel density changes. Progress reports per page, settings re-run on the loaded file, and the whole pipeline (pdf.js render, pdf-lib rebuild) runs in this tab with no upload step.',
    icon: 'file-down',
    intents: [
      'compress pdf online free',
      'reduce pdf file size',
      'pdf compressor without upload',
      'make pdf smaller offline',
      'shrink pdf size in browser',
      'pdf size reducer 100 kb',
      'compress scanned pdf',
      'smaller pdf file size',
    ],
    features: [
      'Render scale 0.75× / 1× / 1.5× / 2× and JPEG quality 30–95% — the two knobs that actually move the file size',
      'An honest verdict either way: the result card reports the real delta and says "keep the original" when rasterization lost',
      'Original print dimensions preserved — the new page carries the scale-1 point size whatever the render scale',
      'Per-page progress during the run, and settings changes re-run the compression on the loaded file',
      'The trade named up front: rasterized pages are images — text stops being selectable and searchable',
      'Up to 100 pages per run with the cap stated; everything runs locally, there is no upload code on the page',
    ],
    howItWorks: [
      'Drop the PDF — compression starts immediately at the current settings',
      'Tune scale and quality; the file re-compresses so you can chase the size you need',
      'Read the before/after verdict, then download — or keep the original when the math says so',
    ],
  },
  {
    id: 'time-card',
    name: 'Time Card Calculator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'A week of in/out punches into hours and pay — two pairs per day, break deductions, overnight shifts, overtime over your threshold and gross pay at your rate.',
    description:
      'The timesheet math a punched card would do: seven day rows, each carrying two in/out pairs (for a lunch split) and a break in minutes, with worked time per day and the week totalled in h:mm and decimal hours. An out earlier than its in is read as an overnight shift and counted across midnight rather than negative. Overtime applies after the threshold you set (40 default) at the multiplier you set (1.5 default), and pay — when you add a rate — is regular + overtime with the formula printed under the result, gross before taxes, which the page says rather than guessing. Everything recomputes as you type, times can be typed or picked with the native time input, and the whole week lives in this tab: nothing is stored, synced or sent.',
    icon: 'calendar-clock',
    intents: [
      'time card calculator',
      'work hours calculator weekly',
      'timesheet calculator with overtime',
      'time card with break deduction',
      'weekly hours and pay calculator',
      'overnight shift hours calculator',
      'clock in clock out calculator',
      'calculate hours worked in a week',
    ],
    features: [
      'Two in/out pairs per day plus a break in minutes — the lunch-split case without a second table',
      'Overnight shifts handled: an out before its in counts across midnight, never as negative time',
      'Overtime after a configurable weekly threshold at a configurable multiplier — 40 h and 1.5× are defaults, not gospel',
      'Pay computed as regular + overtime with the formula printed underneath, gross before taxes (and it says so)',
      'Totals in both h:mm and decimal hours, per day and for the week',
      'Everything recomputes live; the week is tab state only — nothing stored, synced or submitted',
    ],
    howItWorks: [
      'Fill the punches per day — one pair if the shift is continuous, two with a lunch split, break minutes in the last column',
      'Set the overtime threshold, multiplier and hourly rate (optional) in the pay settings',
      'Read the day column and the week summary; every number recomputes as you edit',
    ],
  },
  {
    id: 'grade',
    name: 'Grade Calculator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Weighted grade over your coursework, the "what do I need on the final" solver, and GPA on the 4.0 scale — three calculators, formulas printed, nothing stored.',
    description:
      'The three grade questions, one page. Weighted grade: rows of score % and weight %, computed over the graded portion with the honest note that the ungraded remainder is standing, not prediction. The final-exam solver: current grade, the final\'s weight and the target produce the required score with the algebra shown — x = (target − current × (1 − w)) ÷ w — and a plain-language verdict that names unreachable targets ("needs more than 100%") instead of printing a fantasy number. GPA: courses with credit hours and letter or percent grades, summed as points × credits ÷ credits on the standard unweighted 4.0 mapping (A=4.0, A−=3.7, B+=3.3 … F=0), with percents converted on the 90/80/70/60 band and the school-varies caveat stated. Weights that do not sum to 100 are handled honestly; nothing is saved between visits.',
    icon: 'award',
    intents: [
      'grade calculator',
      'weighted grade calculator',
      'what do i need on my final',
      'final grade calculator',
      'gpa calculator college',
      'test grade calculator weighted',
      'calculate my gpa 4.0 scale',
      'grade needed on final exam',
    ],
    features: [
      'Weighted grade over rows of score % and weight %, computed on the graded portion and labeled as standing, not prediction',
      'The final solver prints the algebra and the verdict — including "not reachable on this final alone" when the required score exceeds 100%',
      'GPA on the standard unweighted 4.0 mapping from letters or percents, weighted by credit hours',
      'Percents convert through the 90/80/70/60 letter band, and the school-varies caveat is on the page',
      'Partial weights are honest: the formula says "over the graded weights so far", never a fake projection',
      'Three tabs, live recomputation, formulas printed under every result, nothing persisted',
    ],
    howItWorks: [
      'Pick the question: your current weighted grade, the score the final requires, or the term GPA',
      'Fill the rows — scores and weights, or courses with credits and letters (percents work too)',
      'Read the result with its formula and the honest caveats printed right beneath it',
    ],
  },
  {
    id: 'todo',
    name: 'Local Checklist',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'A to-do list that lives in your browser: add, tick, edit, reorder, filter — persisted in localStorage, synced with nobody, gone when you clear it.',
    description:
      'A checklist that does the boring parts right: Enter to add, a click to tick, double-click (or the pencil) to edit inline, drag to reorder with up/down buttons as the accessible fallback, All / Active / Done filters, a clear-completed counter, and a "copy as Markdown" export that pastes a GitHub-flavored task list into any issue or note. Persistence is exactly what the name says: the list is saved in this browser\'s localStorage, loaded on the next visit, and stored nowhere else — no account, no sync, no server, with the deletion story spelled out (browser data or the Delete-everything button, then it is gone). The empty states carry the honest instructions, and the storage read is defensive: a corrupted or foreign JSON blob is discarded rather than crashing the page.',
    icon: 'list-todo',
    intents: [
      'todo list online',
      'simple to do list free',
      'checklist app no sign up',
      'todo list local storage',
      'online checklist maker',
      'task list without account',
      'to do list browser',
      'markdown checklist copy',
    ],
    features: [
      'Enter-to-add, click-to-tick, double-click-to-edit — the verbs are where your hands already are',
      'Drag to reorder with keyboard/touch-friendly up-down buttons as the honest fallback',
      'All / Active / Done filters with live open-of-total counts, and a Clear-completed that names its target',
      'Copy as Markdown: the list exports as a GitHub-flavored task list ready for issues, PRs and notes',
      'localStorage persistence that survives reloads — and a spelled-out deletion story, because that is the privacy',
      'Defensive storage read: a corrupted or foreign blob is discarded, the page never crashes on its own history',
    ],
    howItWorks: [
      'Type in the box and press Enter — items render immediately and persist on change',
      'Tick, edit (double-click), drag or arrow items into order, and filter to what is left',
      'Copy the list as Markdown when it needs to travel, or clear it — the storage story is on the page',
    ],
  },
  {
    id: 'meme',
    name: 'Meme Maker',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Top-and-bottom text memes on your own images — classic Impact style, no watermark.',
    description:
      'The classic meme layout, done properly: drop in your own picture, type the top and bottom captions, and the canvas draws them in the white-with-black-outline style the format demands — wrapping long lines to two, scaling the type, uppercasing on request. Download a clean PNG with no watermark and no signup, and know that the picture never left your device.',
    icon: 'laugh',
    intents: [
      'meme generator online',
      'meme maker free no watermark',
      'add captions to photo',
      'top and bottom text meme',
      'make a meme from my photo',
      'funny caption maker',
      'meme creator without signup',
      'image caption generator',
    ],
    features: [
      'Classic Impact-style captions: white fill, black outline, centered',
      'Long captions wrap to two lines instead of running off the edge',
      'Font-size slider, auto-uppercase toggle, live canvas preview',
      'Load a generated sample image, or drop in your own PNG/JPEG/WebP',
      'Watermark-free PNG download at the image\u2019s own resolution',
      'Rendered entirely in this tab — your photo is never uploaded',
    ],
    howItWorks: [
      'Drop an image in, or load the built-in sample to try it',
      'Type the top and bottom captions, set the size, flip uppercase off if you want',
      'Download the PNG — no watermark, no account, nothing uploaded',
    ],
  },
  {
    id: 'svg-convert',
    name: 'SVG to PNG/JPG',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Rasterize SVG markup to PNG or JPG at any size and background — crisp at any scale.',
    description:
      'Paste SVG markup or drop an .svg file and render it to a PNG or JPG at exactly the size you need — same size, 2×, 4×, or a custom box with the aspect locked. Pick a background (transparent for PNG, white for JPG, or any color), and download. Scripts and external references are stripped from the markup before anything renders, and the page says so when it did.',
    icon: 'shapes',
    intents: [
      'svg to png',
      'svg to jpg converter',
      'convert svg to png online',
      'svg to png high resolution',
      'export svg as png',
      'svg rasterizer online',
      'svg transparent background png',
      'svg file to image',
    ],
    features: [
      'Paste markup or drop an .svg file — live render as you edit',
      'Render at the native size, 0.5× to 4× quick scales, or any custom width/height',
      'Aspect lock keeps proportions while you scale',
      'Transparent, white, black or custom background — JPG transparent is forced white, honestly',
      'Scripts and external references stripped before render, with a visible note when it happened',
      'PNG/JPG download, quality slider for JPG',
    ],
    howItWorks: [
      'Paste your SVG or drop the file — it renders immediately',
      'Set the size and background, or hit a scale preset',
      'Download the PNG or JPG at exactly that size',
    ],
  },
  {
    id: 'cipher',
    name: 'Cipher Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'ROT13, Caesar, Atbash and Vigenère in one box — with a Caesar brute-force view.',
    description:
      'Four classical ciphers in one page: ROT13 for the forum-spoiler classic, Caesar with a shift dial and a brute-force table that shows all 25 rotations so you can read the answer instead of guessing, Atbash for the mirror alphabet, and Vigenère with a real tabula-recta implementation. Case and punctuation survive every transform, so decoding feels like decoding, not like fixing the decoder.',
    icon: 'key-round',
    intents: [
      'rot13 encoder',
      'caesar cipher decoder',
      'cipher solver online',
      'vigenere cipher encoder',
      'atbash cipher translator',
      'decode caesar cipher',
      'rot13 decode',
      'secret message encoder',
    ],
    features: [
      'ROT13, Caesar, Atbash and Vigenère — one box, live output',
      'Caesar brute-force panel: all 25 shifts with the current one highlighted',
      'Vigenère with encode/decode, case preserved, key positions that survive punctuation',
      'ROT13 and Atbash are their own inverse — the page says so instead of hiding it',
      'Copy the result in one click',
      'Pure letter math on this device — nothing to upload, nothing to leak',
    ],
    howItWorks: [
      'Type or paste the message — the transformed text appears as you type',
      'Pick a cipher and its parameters (shift, key, direction)',
      'Copy the output, or scan the brute-force table when the shift is unknown',
    ],
  },
  {
    id: 'due-date',
    name: 'Due Date Estimator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Pregnancy due date from LMP or conception, with weeks-progress and milestones.',
    description:
      'A due-date estimator that does the arithmetic the clinic does: Naegele\u2019s rule from the last period (280 days, adjusted for your cycle length) or 266 days from conception, then the rest of the picture — gestational age today, trimester, days remaining, a progress bar across the 280 days, and the standard milestones with real dates. Framed honestly as an estimate, never as medical advice.',
    icon: 'baby',
    intents: [
      'pregnancy due date calculator',
      'due date calculator by lmp',
      'how many weeks pregnant calculator',
      'conception date calculator',
      'pregnancy week calculator',
      'estimated due date',
      'pregnancy countdown',
      'due date from conception',
    ],
    features: [
      'Naegele\u2019s rule: LMP + 280 days, shifted by cycle length minus 28',
      'Conception mode: + 266 days, with gestational age kept consistent',
      'Live weeks-and-days pregnant, trimester badge, days remaining, progress bar',
      'Milestone dates: end of first trimester, halfway, viability, early term, due',
      'Honest edge states: future dates, overdue, and past-42-weeks all handled',
      'Framed as an estimate — not medical advice, confirmed on the page',
    ],
    howItWorks: [
      'Pick the first day of the last period (or the conception date)',
      'Adjust the cycle length if it is not 28 days',
      'Read the estimate, the weeks progress and the milestone dates',
    ],
  },
  {
    id: 'word-frequency',
    name: 'Word Frequency & Readability',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Keyword density table plus Flesch reading ease — see what your writing actually is.',
    description:
      'Paste any text and see it the way a search engine and a reading teacher do: a keyword density table sorted by count with a stopword switch, the totals that frame it (words, unique words, sentences, averages, reading time), and honest readability math — Flesch reading ease with its label and the Flesch-Kincaid grade level, both computed from a real syllable heuristic on your actual words.',
    icon: 'chart-column',
    intents: [
      'word frequency counter',
      'keyword density checker',
      'text analyzer online',
      'flesch reading ease calculator',
      'word counter with density',
      'readability score checker',
      'seo keyword density tool',
      'most frequent words in text',
    ],
    features: [
      'Keyword density: Word, Count and % across the whole text, top 20 sorted live',
      'Stopword switch (off by default — you see everything first)',
      'Totals row: words, unique words, sentences, average sentence length, reading time',
      'Flesch reading ease with the standard label bins',
      'Flesch-Kincaid grade level for school-context writing',
      'Unicode-aware tokenization — contractions count as one word',
    ],
    howItWorks: [
      'Paste or type the text — every number updates as you type',
      'Toggle the common-words filter to see the content words that carry meaning',
      'Read the density table and the readability cards side by side',
    ],
  },
  {
    id: 'vcard',
    name: 'vCard & QR',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Contact card to .vcf download and a scannable QR — share a contact without typing it.',
    description:
      'Build a contact card the way phones want it: a real vCard 3.0 file you download as .vcf (double-click to add to any address book) and a QR code of the same card that another phone scans to save the contact without typing. Fields emit only when filled, values escape correctly, UTF-8 names survive intact, and the QR regenerates live as you edit.',
    icon: 'contact',
    intents: [
      'vcard generator online',
      'create vcf file',
      'qr code business card',
      'contact card qr code',
      'vcf file maker',
      'digital business card free',
      'save contact qr code',
      'vcard qr code generator',
    ],
    features: [
      'vCard 3.0 preview that updates live as you type',
      'Download a proper .vcf — opens in every address book',
      'QR code of the full card, regenerated with a short debounce',
      'Only filled fields are emitted — no placeholder lines',
      'RFC-correct escaping and real UTF-8 for non-ASCII names',
      'Honest scan tip: cards this dense need about 3 cm printed',
    ],
    howItWorks: [
      'Fill in the name first (that is the only required field), then whatever else applies',
      'Watch the vCard preview and QR update live',
      'Download the .vcf or let the other phone scan the QR',
    ],
  },
  {
    id: 'calendar-link',
    name: 'Calendar Links & .ics',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'One event → Google, Outlook and Yahoo links plus a real .ics download.',
    description:
      'Type an event once and get the three deep links everyone actually clicks — Google Calendar, Outlook.com and Yahoo — plus an RFC 5545 .ics file with proper escaping and line folding that works in Apple Calendar, Thunderbird and everything else. All-day events switch to date semantics with the exclusive end day handled exactly right, which is where most hand-rolled .ics goes wrong.',
    icon: 'calendar-plus',
    intents: [
      'google calendar event link',
      'add to calendar link generator',
      'create ics file online',
      'outlook calendar link',
      'calendar button generator',
      'generate ics from event',
      'yahoo calendar link',
      'add to calendar button',
    ],
    features: [
      'Google Calendar, Outlook.com and Yahoo deep links from one form',
      'Real .ics preview with RFC 5545 escaping and 75-octet line folding',
      'All-day events: date semantics, exclusive end day, per-provider formats',
      'Download the .ics with a filename from the event title',
      'Location and description flow into every target',
      'Deterministic event UID so re-downloads replace, not duplicate',
    ],
    howItWorks: [
      'Fill in the title and the times (or flip on all-day)',
      'Copy the provider link your audience uses, or download the .ics',
      'Both the links and the file carry the same event — no drift',
    ],
  },
  {
    id: 'px-rem',
    name: 'px ⇄ rem Converter',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'px, rem, em and % at once, with a clamp() builder for fluid type.',
    description:
      'The CSS unit converter that shows all four units at once — px, rem, em and % — against a configurable root size and a separate em context, so the numbers match what the browser actually computes. A quick-reference grid re-derives as you change the root, and a clamp() builder emits fluid-type CSS with the honest warning about what happens when min exceeds max.',
    icon: 'ruler',
    intents: [
      'px to rem converter',
      'rem to px calculator',
      'px to em converter',
      'css unit converter',
      'clamp generator css',
      'fluid font size clamp',
      'rem calculator root 16',
      'convert pixels to rem',
    ],
    features: [
      'One value in, all four units out — px, rem, em and %',
      'Configurable root size (the 16px default is a click away) and em context',
      'Quick-reference grid of common sizes, live with the root',
      'clamp() builder: min, ideal and max with copyable CSS output',
      'Honest warning when min > ideal > max does not hold — the browser will not interpolate',
      'Values rounded to 4 decimals with trailing zeros trimmed',
    ],
    howItWorks: [
      'Set the root size your project uses',
      'Type a value in any unit and read the other three',
      'Use the clamp builder when the type needs to flex between bounds',
    ],
  },
  {
    id: 'binary',
    name: 'Binary & Hex Text Converter',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Text ↔ binary, hex, octal and decimal — live both ways, UTF-8 and ASCII.',
    description:
      'A two-pane converter that goes both ways live: type text and read the bytes, or paste bytes and read the text. Binary, hexadecimal, octal and decimal bases, UTF-8 (full Unicode, multi-byte shown honestly) or strict ASCII that names the first out-of-range character and its position instead of failing silently. Grouping is forgiving — spaces, newlines, commas and 0x prefixes all parse.',
    icon: 'binary',
    intents: [
      'text to binary converter',
      'binary to text translator',
      'binary code translator',
      'text to hex converter',
      'decimal to binary',
      'binary translator english',
      'utf 8 to binary',
      'ascii to binary',
    ],
    features: [
      'Two panes, live both ways — no mode toggle to get wrong',
      'Binary, hex, octal and decimal bases',
      'UTF-8 mode with real byte counts for multi-byte characters',
      'Strict ASCII mode that names the offending character and position',
      'Forgiving byte grouping: spaces, newlines, commas, 0x prefixes',
      'Invalid byte sequences reported with the first bad byte, not a dead pane',
    ],
    howItWorks: [
      'Type text on the left, or paste bytes on the right',
      'Pick the base and the encoding',
      'Copy either side — the conversion updates live in both directions',
    ],
  },
  {
    id: 'sound-tools',
    name: 'Sound Tools',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'dB meter, tone generator, guitar tuner and metronome — four sound tools on one page.',
    description:
      'A decibel meter that turns your microphone into a (honestly labelled) sound-level estimate with calibration, a tone generator from 20 Hz to 20 kHz in four waveforms, a guitar tuner with autocorrelation pitch detection and a cents needle, and a drift-free metronome scheduled on the audio clock. Nothing is recorded — streams are analysed in memory and dropped on stop.',
    icon: 'volume-2',
    intents: [
      'decibel meter online',
      'sound level meter online',
      'tone generator online',
      'guitar tuner online',
      'online metronome',
      'pitch detector online',
      'test my microphone sound',
      'frequency generator online',
    ],
    features: [
      'SPL meter with peak/avg/min stats and an adjustable calibration offset',
      'Tone generator, 20 Hz–20 kHz, sine/square/sawtooth/triangle',
      'Guitar tuner: autocorrelation pitch detection, cents needle, standard-tuning reference',
      'Metronome with audio-clock scheduling, accents and tap tempo',
      'Nothing recorded — the mic stream is analysed in memory and dropped on stop',
      'Honest labeling throughout: the meter is an estimate until you calibrate it',
    ],
    howItWorks: [
      'Pick the mode; the mic modes ask permission and start analysing immediately',
      'Adjust the controls live — frequency, tempo, calibration all update mid-run',
      'Stop when done; every audio resource is closed, nothing lingers',
    ],
  },
  {
    id: 'tts',
    name: 'Text to Speech Reader',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Read text aloud with your browser’s own voices — chunked, pausable, honest about limits.',
    description:
      'Paste any text and have it read aloud through the Web Speech API with your choice of installed voice, rate, pitch and volume. Long text is split into sentence chunks because browsers truncate single long utterances — the chunk list is the real playback order, the current line is highlighted, and pause/resume/stop all work. No voices installed, or no synthesis engine? The page says so instead of faking it.',
    icon: 'speech',
    intents: [
      'text to speech online',
      'read text aloud',
      'tts reader online',
      'text to speech free',
      'natural reader online',
      'read my essay aloud',
      'proofread by listening',
      'speech synthesis online',
    ],
    features: [
      'Every voice your OS and browser ship, labelled local vs network',
      'Rate 0.5–2×, pitch and volume — all adjustable before and during playback',
      'Sentence-bounded chunking that survives the browser’s long-utterance truncation',
      'Real progress: current chunk highlighted, “chunk i of n” live',
      'Pause, resume and stop that actually stop the audio clock',
      'Explicit honest states when the engine is missing or voices are empty',
    ],
    howItWorks: [
      'Paste the text — the chunk preview updates as you type',
      'Pick a voice and set the rate, pitch and volume',
      'Press Read aloud; pause or stop any time, the queue is real and visible',
    ],
  },
  {
    id: 'fuel-cost',
    name: 'Trip Fuel Cost Calculator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Distance × efficiency × price, split per passenger — km or miles, liters or gallons.',
    description:
      'Work out what a trip actually costs: distance in km or miles, efficiency in L/100km, km/L, MPG (US) or MPG (UK), fuel price per liter or per gallon in your currency, an even passenger split and a round-trip toggle. All units normalize internally to liters per kilometer and currency per liter, so no combination gives a silently wrong answer — and the equivalence line shows the same consumption spoken three ways.',
    icon: 'fuel',
    intents: [
      'fuel cost calculator',
      'trip cost calculator',
      'gas cost calculator road trip',
      'fuel cost per km',
      'mpg to l/100km converter',
      'split petrol cost between friends',
      'car travel expenses calculator',
      'petrol price trip calculator',
    ],
    features: [
      'Four consumption units (L/100km, km/L, MPG US, MPG UK) accepted directly',
      'Price per liter or per US/UK gallon in $, €, £, ₹ or unit-free',
      'Even passenger split and a round-trip toggle',
      'Per-km (or per-mile) cost for comparing vehicles or routes',
      'L/100km ↔ MPG (US) ↔ MPG (UK) equivalence, shown with the gallon caveat',
      'Straight multiplication once the units agree — the formula is on the page',
    ],
    howItWorks: [
      'Type the distance and pick km or miles',
      'Enter efficiency and price in whatever units you think in',
      'Read fuel needed, total cost, per-km cost and the per-passenger split',
    ],
  },
  {
    id: 'salary',
    name: 'Salary Converter',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Hourly ↔ annual in every direction, with unpaid breaks and overtime done honestly.',
    description:
      'One amount in one frequency becomes the full table: hourly, daily, weekly, two-weekly, monthly and annual — gross, pre-tax, and printed with the exact pipeline so you can check it. Unpaid break minutes shrink the paid shift before anything is annualized, overtime enters at its multiplier on top of the base, and the tool refuses to invent a take-home figure because a bracket-less “net” estimate would be a lie.',
    icon: 'wallet',
    intents: [
      'salary to hourly calculator',
      'hourly to annual salary',
      'annual to monthly salary converter',
      'wage calculator per year',
      'salary after unpaid break',
      'overtime pay calculator',
      'what is my yearly pay',
      'pay rate converter',
    ],
    features: [
      'All six frequencies answered at once from one input',
      'Unpaid break minutes deducted before annualizing — the number most converters skip',
      'Overtime hours at a configurable multiplier, added on top of the base',
      'Work-weeks-per-year input for teachers, seasonal and contract schedules',
      'The full pipeline printed so every figure is checkable',
      'Gross, pre-tax, honestly labelled — no fake take-home math',
    ],
    howItWorks: [
      'Enter an amount and how often it is paid',
      'Fill the schedule: shift hours, days a week, unpaid break, overtime, weeks a year',
      'Read the table — every row derived from the same printed pipeline',
    ],
  },
  {
    id: 'sleep',
    name: 'Sleep Cycle Calculator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Bedtimes and alarm times that land on whole 90-minute sleep cycles.',
    description:
      'Two directions: tell it when your alarm rings and read the bedtimes that complete 3–6 sleep cycles before it, or say “I am going to bed now” and read the alarm times that land between cycles. Fall-asleep latency is configurable (default 15 minutes), the six-cycle option is marked as the most-rested target, and the page states plainly that 90 minutes is a population average, not a law — this is a planning aid, not medical advice.',
    icon: 'moon',
    intents: [
      'sleep calculator',
      'sleep cycle calculator',
      'what time should i sleep',
      'best time to wake up',
      '90 minute sleep rule',
      'bedtime calculator',
      'how much sleep do i need',
      'sleep time calculator wake up at',
    ],
    features: [
      'Wake-at mode: bedtimes completing 6 → 3 cycles before the alarm',
      'Sleep-now mode: alarm times after whole cycles from lights-out',
      'Adjustable fall-asleep latency, 0–120 minutes',
      'Each row labelled with total sleep and an honest expectation',
      'Midnight-wrapping times handled (21:45, 00:45, 02:15)',
      'The 80–110 minute real-world variation stated, not hidden',
    ],
    howItWorks: [
      'Pick the direction: a fixed alarm, or going to bed right now',
      'Set the alarm (or lights-out) time and your fall-asleep latency',
      'Read the ranked times — six cycles is the most-rested target',
    ],
  },
  {
    id: 'pace',
    name: 'Running Pace Calculator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Pace and speed from any run, splits table, and Riegel race predictions 5K → marathon.',
    description:
      'Enter a distance and a time and read pace per km and per mile, speed in both units, an even-pace splits table over the run, and race-time predictions by Riegel’s formula T₂ = T₁ × (D₂/D₁)^1.06 for 5K, 10K, half marathon and marathon — each with its projected per-km pace. The page says what the formula assumes: predictions hold for training that actually scales with the target distance.',
    icon: 'footprints',
    intents: [
      'running pace calculator',
      'pace calculator km',
      'marathon time predictor',
      'race time predictor',
      'running splits calculator',
      '5k pace chart',
      'speed to pace converter running',
      'half marathon pace calculator',
    ],
    features: [
      'Pace per km and per mile from any distance-time pair',
      'Speed in km/h and mph for treadmill cross-checks',
      'Even-pace splits table with elapsed and per-split times',
      'Riegel predictions for 5K, 10K, half and full marathon',
      'Projected per-km pace for each predicted race',
      'The 1.06 exponent and its assumptions explained on the page',
    ],
    howItWorks: [
      'Enter a run or race distance and its finish time',
      'Read pace, speed and the splits table immediately',
      'Use the prediction table to sanity-check a goal race',
    ],
  },
  {
    id: 'one-rep-max',
    name: 'One Rep Max Calculator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Estimate your 1RM with Epley, Brzycki, Lander and Lombardi — plus the training-percentage table.',
    description:
      'A weight you can lift for r reps becomes an estimated one-rep max under four published formulas, shown side by side so the disagreement is visible, plus a consensus averaging Epley, Brzycki and Lander. Below it, the training table maps %1RM to load and the rep count it typically allows, from 95% strength doubles to 60% endurance work. The honest window is stated: estimates are tight at 1–6 reps and drift apart beyond.',
    icon: 'dumbbell',
    intents: [
      'one rep max calculator',
      '1rm calculator',
      'bench press calculator',
      'epley formula calculator',
      'brzycki calculator',
      'strength percentage chart',
      'squat max calculator',
      'deadlift one rep max',
    ],
    features: [
      'Four published formulas side by side: Epley, Brzycki, Lander, Lombardi',
      'Consensus 1RM averaging the three the evidence favors',
      'Training table from 95% down to 60% with loads and typical reps',
      'kg or lb throughout',
      'Divergence between formulas visible instead of hidden',
      'The supervised-test caveat printed, not buried',
    ],
    howItWorks: [
      'Enter a completed (or completable) set: weight and reps',
      'Read the four estimates and the consensus',
      'Program from the percentage table — 80s for hypertrophy, 90s+ for strength',
    ],
  },
  {
    id: 'fraction',
    name: 'Fraction Calculator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Add, subtract, multiply and divide fractions with every step shown, plus ↔ decimal conversion.',
    description:
      'Two fractions and one operation produce the answer four ways — unreduced, reduced by the GCD, as a mixed number, and as a decimal — with the worked steps printed: LCD rewriting for + and −, cross products for ×, keep-change-flip for ÷, and the GCD that reduced the result. A converter handles fraction → decimal with real long division and repeat detection (1/7 → 0.(142857)), and decimal → fraction exactly up to 8 places, honestly approximate beyond.',
    icon: 'divide',
    intents: [
      'fraction calculator',
      'adding fractions calculator',
      'subtracting fractions calculator',
      'multiply fractions calculator',
      'divide fractions calculator',
      'simplify fractions calculator',
      'fraction to decimal converter',
      'decimal to fraction converter',
    ],
    features: [
      'All four operations with the full worked steps, not just the answer',
      'LCD rewriting for addition and subtraction, cross products for multiplication',
      'Division with keep-change-flip and a named zero-fraction case',
      'GCD reduction, mixed-number form and terminating/repeating decimals',
      'Fraction → decimal with detected repeating cycles parenthesised',
      'Decimal → fraction: exact to 8 places, honestly approximate beyond',
    ],
    howItWorks: [
      'Type both fractions, tap the operation',
      'Read the reduced answer, mixed number and decimal expansion',
      'Follow the numbered steps — every intermediate value is shown',
    ],
  },
  {
    id: 'quadratic',
    name: 'Quadratic Equation Solver',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Roots, discriminant, vertex and factored form for ax² + bx + c = 0 — with the steps and a plot.',
    description:
      'Enter a, b and c and get the discriminant, both roots (real, repeated, or complex conjugates stated as such), the vertex with its axis of symmetry, the opening direction, and the factored form when the roots print cleanly. The worked steps substitute your real numbers into D = b² − 4ac and the quadratic formula, and an SVG plot draws the actual parabola — auto-scaled around the vertex with the roots marked on the axis — so the shape and the algebra always agree.',
    icon: 'function-square',
    intents: [
      'quadratic formula calculator',
      'solve quadratic equation',
      'quadratic equation solver',
      'discriminant calculator',
      'parabola vertex calculator',
      'roots of quadratic equation',
      'complex roots calculator',
      'quadratic graph plotter',
    ],
    features: [
      'Discriminant with the nature of the roots stated, not implied',
      'Real, repeated and complex-conjugate roots all handled',
      'Vertex, axis of symmetry and opening direction',
      'Factored form when the roots print cleanly, named otherwise',
      'Worked steps with your actual numbers substituted',
      'An SVG parabola that rescales around the vertex, roots marked',
    ],
    howItWorks: [
      'Type a, b and c (a ≠ 0 — the page says why)',
      'Read roots, discriminant, vertex and the factored form',
      'Check the steps and the plot — they come from the same math',
    ],
  },
  {
    id: 'spreadsheet',
    name: 'Spreadsheet Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Open xlsx or CSV, edit cells, run formulas, pivot, find-and-replace and export — a real spreadsheet that never uploads your file.',
    description:
      'A working spreadsheet in your browser tab. Open .xlsx, .xls or .csv files — or start from the demo sheet — and edit cells directly with a formula bar, a lite formula engine (SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, ROUND, ABS, cell refs and arithmetic), per-column statistics, one-click sorting, group-by pivot summaries and find-and-replace with regex. Multiple sheets from one workbook open as tabs. Export back to .xlsx or .csv. Everything — parsing, recalculation, export — happens on this device.',
    icon: 'table-2',
    intents: [
      'xlsx viewer online',
      'open excel file online',
      'csv editor online',
      'spreadsheet formulas online',
      'xlsx to csv converter',
      'free excel alternative online',
      'edit spreadsheet in browser',
      'pivot table online free',
    ],
    features: [
      'Opens .xlsx, .xls and .csv — multi-sheet workbooks open as tabs',
      'Formula bar plus a lite formula engine with real Excel-style errors (#REF!, #DIV/0!, #VALUE!)',
      'Column statistics, numeric-aware sorting and a group-by pivot panel',
      'Find and replace across the sheet, plain text or regex',
      'Export to .xlsx or .csv — round-trips with desktop Excel',
      'Files never upload: parsing and export run in this tab',
    ],
    howItWorks: [
      'Drop a file (or use the demo sheet) — sheets appear as tabs',
      'Click any cell, type a value or =FORMULA, press Enter to commit',
      'Pivot, sort or find-and-replace, then download as xlsx or csv',
    ],
  },
  {
    id: 'chart-maker',
    name: 'Chart Maker',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Paste a table, get a publication-ready bar, line, area, pie, donut or scatter chart — download as PNG or SVG, drawn locally.',
    description:
      'Turn any pasted CSV, TSV or semicolon table into a clean chart: grouped bars, lines, filled areas, pie, donut with a center total, or scatter plots with real numeric axes. Edit the title and axis labels, toggle grid lines and the legend, show or hide series, and set manual axis bounds when you need exact scales. Hover any mark for the underlying numbers. Export a crisp PNG for slides or a resolution-independent SVG for print — both rendered from the same hand-drawn SVG engine, entirely on this device.',
    icon: 'line-chart',
    intents: [
      'chart maker online',
      'bar chart maker',
      'line chart generator',
      'pie chart maker free',
      'graph maker from data',
      'scatter plot maker',
      'csv to chart online',
      'svg chart generator',
    ],
    features: [
      'Six chart types: bar, line, area, pie, donut and scatter',
      'Paste from any spreadsheet — comma, tab or semicolon separated, with % and thousands separators',
      'Series visibility toggles and a per-series stats strip (n, sum, average, range)',
      'Editable titles, axis labels, grid lines, legend and manual Y-axis bounds',
      'Native tooltips on every bar, point and slice',
      'PNG (2× retina) and SVG export — no watermarks, no account',
    ],
    howItWorks: [
      'Paste or type your table — the sample chart renders immediately',
      'Pick a chart type and tune titles, axes, grid and legend',
      'Download PNG for slides or SVG for print-perfect scaling',
    ],
  },
  {
    id: 'resume',
    name: 'Resume Builder',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Build an ATS-friendly resume with a live A4 preview, themes and print-perfect PDF — autosaved only in your browser, never uploaded.',
    description:
      'A full resume editor with a real-time A4 preview: header and contacts, summary, experience with reorderable bullet points, education, skills and projects. Switch between serif, modern and compact themes with four accent colors. The preview is a genuine 210×297 mm document — print it through your browser for a pixel-perfect PDF, or download a self-contained HTML copy. Drafts autosave to localStorage with an honest status line, and the structure is deliberately ATS-safe: single column, standard headings, real selectable text.',
    icon: 'file-user',
    intents: [
      'free resume builder',
      'resume maker online',
      'ats friendly resume builder',
      'resume builder no signup',
      'cv maker free online',
      'print resume to pdf',
      'minimal resume template',
      'private resume builder offline',
    ],
    features: [
      'Live A4 preview that reflows as you type — true 210×297 mm layout',
      'Repeatable experience, education and projects with reorder and remove controls',
      'Three themes × four accents, all readable on paper',
      'Print-perfect PDF via your own browser — no watermark, no paywall at export',
      'Autosave to localStorage with a visible status; nothing uploads, ever',
      'ATS-friendly output: single column, standard headings, real text',
    ],
    howItWorks: [
      'Start from the sample or clear it — edit on the left, watch the A4 sheet on the right',
      'Pick a theme and accent; reorder bullets until it reads right',
      'Print to PDF from the browser, or download the HTML copy',
    ],
  },
  {
    id: 'video-studio',
    name: 'Video Studio',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'Compress and trim video on your own CPU with a real ffmpeg engine — no upload queue, no watermark, no account, no file-size gate.',
    description:
      'Two real video operations, powered by ffmpeg.wasm self-hosted on this site and running entirely in your tab. Compress: quality presets or a custom CRF, resolution capping, frame-rate control and audio re-encode, copy or removal. Trim: scrub the preview, set start and end from the playhead or type exact seconds, then choose a fast keyframe cut or a frame-exact re-encode. Progress is honest and live; output is standard MP4 (H.264 + AAC) that plays anywhere. The ~32 MB engine loads once and caches; after that everything is local.',
    icon: 'film',
    intents: [
      'compress video online',
      'reduce video file size',
      'trim video online free',
      'cut video clips online',
      'video compressor no upload',
      'mp4 compressor free no watermark',
      'video cutter precise',
      'shrink video for email',
    ],
    features: [
      'Real ffmpeg engine on your CPU — no server round-trip, no queue',
      'Compress: CRF quality control, resolution caps, fps and audio modes',
      'Trim: playhead-based start/end plus fast keyframe cut or frame-exact re-encode',
      'Live progress bar with honest on-device timing expectations',
      'Standard MP4 (H.264/AAC) output with faststart for instant playback',
      'The engine is self-hosted and caches after first use — files never upload',
    ],
    howItWorks: [
      'Pick a video — the engine fetches once in the background (~32 MB, cached)',
      'Compress: choose quality, resolution and audio; Trim: set the range from the playhead',
      'Watch live progress, then download the MP4',
    ],
  },
  {
    id: 'bg-remove',
    name: 'Background Remover',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'AI cutouts and solid-color keys computed in this tab — people, products and pets, with the photo never leaving the device.',
    description:
      'Two honest removal engines, one page. AI cutout runs an ISNet segmentation model in this browser: the model binary is a one-time download from the vendor CDN, then every image — headshots, products, pets — is segmented locally and exported as a transparent PNG. Solid-color key is pure canvas math: it samples the corners to guess the key color, applies your tolerance through a soft alpha ramp, and is instant with zero downloads — the right tool for green screens and white product shots. A drag slider compares original against cutout over a checkerboard so transparency is visible rather than guessed, and the PNG download keeps the alpha channel.',
    icon: 'image-minus',
    intents: [
      'remove background from image',
      'background remover online free',
      'make image background transparent',
      'ai background remover no upload',
      'delete photo background on device',
      'product photo white background remover',
      'green screen remover online',
      'transparent png maker',
    ],
    features: [
      'AI cutout with ISNet fp16 running locally — heads, products, animals, any foreground',
      'Solid-color key with corner auto-sampling, tolerance control and a soft alpha ramp',
      'Before/after drag slider over a checkerboard — transparency you can see, not guess',
      'Transparent PNG download with alpha intact and an honest before/after size readout',
      'Paste from clipboard (Ctrl+V) straight into the picker, alongside file selection',
      'Files never upload: only the one-time model binary comes from the vendor CDN',
    ],
    howItWorks: [
      'Drop or paste an image — AI cutout for any subject, solid-key for flat backgrounds',
      'AI mode fetches the model once and segments locally; key mode samples corners and thresholds',
      'Drag the compare slider to inspect the edges, then download the transparent PNG',
    ],
  },
]

// ---------------------------------------------------------------------------
// Variant / alias plumbing
//
// Sessions are created under VARIANT ids ('drop', 'video-call', …), which are
// also the stable ids stored in the database and in on-device history. The
// catalog only shows the merged tools. These helpers translate between the
// two namespaces in one place.
// ---------------------------------------------------------------------------

/** variant/session id -> top-level tool id (e.g. 'drop' -> 'share'). */
export const APP_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const app of APPS) {
    for (const v of app.variants ?? []) map[v.id] = app.id
  }
  return map
})()

/** Exact match against the top-level tools (used for /slug routing). */
export function getTopApp(id: string): AppDef | undefined {
  const lower = id.toLowerCase()
  return APPS.find((a) => a.id === lower)
}

/** Any session id ('drop', 'beam', …) -> the top-level tool it belongs to. */
export function resolveAppId(id: string): string | undefined {
  const lower = id.toLowerCase()
  return APP_ALIASES[lower] ?? APPS.find((a) => a.id === lower)?.id
}

/**
 * The tool definition for any id — top-level or variant. Display surfaces
 * (headers, history lists, gates) call this so a 'drop' session shows as
 * "Beam".
 */
export function getApp(id: string): AppDef | undefined {
  const resolved = resolveAppId(id)
  return resolved ? APPS.find((a) => a.id === resolved) : undefined
}

/** The variant record for a session id, plus its parent tool. */
export function getVariant(
  id: string,
): { app: AppDef; variant: AppVariant } | undefined {
  const app = getApp(id)
  if (!app) return undefined
  const lower = id.toLowerCase()
  const variant =
    app.variants?.find((v) => v.id === lower) ??
    (app.variants ? undefined : singleVariant(app))
  return variant ? { app, variant } : undefined
}

/** Tools without modes still behave as one implicit variant (their own id). */
function singleVariant(app: AppDef): AppVariant | undefined {
  if (app.variants?.length) return undefined
  return {
    id: app.id,
    name: app.name,
    tagline: app.tagline,
    icon: app.icon,
    features: app.features,
    howItWorks: app.howItWorks,
    deviceNote: app.deviceNote,
  }
}

/** Modes offered by a tool — singles surface as one implicit mode. */
export function variantsOf(app: AppDef): AppVariant[] {
  return app.variants ?? [singleVariant(app) as AppVariant]
}

/** The variant used when something says just "start Beam". */
export function defaultVariantId(app: AppDef): string {
  return app.defaultVariantId ?? app.id
}

/** "Beam" for a canvas session, "Beam · Files" for a drop session. */
export function appDisplay(id: string): { name: string; variantName?: string } {
  const found = getVariant(id)
  if (!found) return { name: id }
  const { app, variant } = found
  return app.variants?.length
    ? { name: app.name, variantName: variant.name }
    : { name: app.name }
}

/** Every id a session may legally be created under (API validation). */
export function getCreatableAppIds(): string[] {
  const ids: string[] = []
  for (const app of APPS) {
    if (app.status !== 'live') continue
    if (app.kind === 'instant') continue
    if (app.variants?.length) {
      // Sessions may be created under the tool id itself (one session serves
      // every mode) or under a variant id (legacy clients and direct links).
      ids.push(app.id)
      for (const v of app.variants) ids.push(v.id)
    } else {
      ids.push(app.id)
    }
  }
  return ids
}

export function getLiveApps(): AppDef[] {
  return APPS.filter((a) => a.status === 'live')
}

export function getLiveAppIds(): string[] {
  return APPS.filter((a) => a.status === 'live').map((a) => a.id)
}

export function appsByCategory(category: AppCategory): AppDef[] {
  return APPS.filter((a) => a.category === category)
}

export function getCategory(id: AppCategory): CategoryDef {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}

/**
 * Per-category accent colors (hex) used for card icons, section chips and
 * hover glows — gives every section a recognizable identity while the brand
 * primary (green) stays reserved for "live / go" actions.
 */
export const CATEGORY_ACCENT: Record<AppCategory, string> = {
  communicate: '#0ea5e9',
  share: '#059669',
  collaborate: '#7c3aed',
  remote: '#d97706',
  utilities: '#dc2626',
  instant: '#0d9488',
}

/** Intention chips shown under the Discover search box. */
export const INTENTION_CHIPS: { label: string; appId: string }[] = [
  { label: 'Send photos from my phone to my laptop', appId: 'drop' },
  { label: 'Share a link with my other device', appId: 'beam' },
  { label: 'Call someone without an app', appId: 'video-call' },
  { label: 'Draw together with my team', appId: 'canvas' },
  { label: 'Take a quick vote in a meeting', appId: 'roundtable' },
  { label: 'Show my screen to someone', appId: 'screen-share' },
  { label: 'Use my phone as a webcam', appId: 'phone-webcam' },
  { label: 'Help my parents fix their computer', appId: 'remote-assist' },
  { label: 'Unzip an archive right now', appId: 'zip' },
  { label: 'Compress photos before emailing', appId: 'image' },
  { label: 'Check a download checksum', appId: 'hash' },
  { label: 'Generate a strong password', appId: 'password' },
]

/**
 * Curated one-click set for the Discover hero + header menu (do-it-first).
 * Values are VARIANT ids: each button starts a real session of that mode.
 */
export const INSTANT_START_APPS = [
  'drop',
  'video-call',
  'screen-share',
  'zip',
  'folder-share',
  'roundtable',
  'image',
  'walkie-talkie',
]

/** Simple intention-first search across names, taglines and intents. */
export function searchApps(query: string): AppDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const words = q.split(/\s+/)
  const scored: { app: AppDef; score: number }[] = []
  for (const app of APPS) {
    // Variant copy joins the haystack so "zip", "walkie" or "webcam" find
    // the merged tool that contains them.
    const variantText = (app.variants ?? [])
      .map((v) => `${v.name} ${v.tagline} ${v.features.join(' ')}`)
      .join(' ')
      .toLowerCase()
    const haystacks = [
      app.name.toLowerCase(),
      app.tagline.toLowerCase(),
      app.description.toLowerCase(),
      app.intents.join(' ').toLowerCase(),
      variantText,
      getCategory(app.category).label.toLowerCase(),
    ]
    let score = 0
    if (app.name.toLowerCase().startsWith(q)) score += 8
    if (app.name.toLowerCase().includes(q)) score += 6
    for (const intent of app.intents) {
      const il = intent.toLowerCase()
      if (il.includes(q)) score += 5
      const matchedWords = words.filter((w) => w.length > 2 && il.includes(w)).length
      score += matchedWords * 2
    }
    if (app.tagline.toLowerCase().includes(q)) score += 2
    if (variantText.includes(q)) score += 2
    if (haystacks[3].split(' ').some((w) => words.includes(w))) score += 1
    if (score > 0) scored.push({ app, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || (a.app.status === 'live' ? -1 : 1))
    .slice(0, 6)
    .map((s) => s.app)
}
