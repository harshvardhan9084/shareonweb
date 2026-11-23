// The Toolhive tool catalog.
//
// IMPORTANT DESIGN PRINCIPLES:
// 1. Toolhive is a HUB of practical tools, organized around human
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
      'Keep the tab open on both devices while a transfer runs. If the connection dips, Toolhive reconnects and you can resend anything.',
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
    tagline: 'Compress, convert and resize images — batch, local, instant.',
    description:
      'One image workbench: shrink photos to a target size or quality, convert between PNG, JPEG and WebP, and resize or rescale whole batches at once. Every pixel is processed on this device with the browser\u2019s own encoder — your photos are never uploaded to anyone.',
    icon: 'image',
    intents: [
      'compress image online',
      'convert png to jpg',
      'convert to webp',
      'resize image online',
      'reduce photo file size',
      'batch image converter',
      'make image smaller kb',
    ],
    features: [
      'Compress with a quality slider or aim at an exact target size',
      'Convert between PNG, JPEG and WebP, in batches',
      'Resize by pixels or percentage with aspect-ratio lock',
      'Before/after preview with the real file-size saving',
      'Everything processed locally — no uploads, ever',
    ],
    howItWorks: [
      'Drop one or many images in',
      'Pick compress, convert or resize and set the options',
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
    name: 'QR Generator',
    kind: 'instant',
    category: 'instant',
    status: 'live',
    tagline: 'QR codes for links, text, Wi\u2011Fi and contact cards \u2014 download as PNG.',
    description:
      'Make a QR code for anything: a URL, plain text, your Wi\u2011Fi network (guests join without you reading the password aloud), or a contact card a phone camera saves directly. Choose the size and error-correction level and download a crisp PNG. Generated on this device.',
    icon: 'qr',
    intents: [
      'qr code generator',
      'wifi qr code',
      'vcard qr code',
      'create qr for link',
      'free qr code download',
    ],
    features: [
      'URL and plain-text QR codes',
      'Wi\u2011Fi mode: guests scan and join the network instantly',
      'vCard mode: scans straight into contacts',
      'Size and error-correction control, crisp PNG download',
      'Rendered locally \u2014 the content never touches a server',
    ],
    howItWorks: [
      'Pick the type: link, text, Wi\u2011Fi or contact card',
      'Fill in the details',
      'Download the PNG or scan it right off the screen',
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
