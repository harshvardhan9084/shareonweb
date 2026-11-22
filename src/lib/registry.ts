// The ShareOnWeb app catalog.
//
// IMPORTANT DESIGN PRINCIPLE: ShareOnWeb is NOT organized around WebRTC/real-time
// capabilities — it is organized around human intentions. Nobody searches for
// a DataChannel. They search for "send a file from my phone to my laptop
// without uploading it." Every app entry starts from that intention.

export type AppCategory =
  | 'communicate'
  | 'share'
  | 'collaborate'
  | 'remote'
  | 'utilities'
  | 'productivity'

export type AppStatus = 'live' | 'soon'

export interface AppDef {
  id: string
  name: string
  category: AppCategory
  status: AppStatus
  /** One-liner written as the intention it serves. */
  tagline: string
  /** Longer explanation shown on the app's landing page. */
  description: string
  /** Lucide icon key (mapped in components/platform/app-icon.tsx). */
  icon: string
  /** Phrases people would actually type or say. Used by Discover search. */
  intents: string[]
  features: string[]
  /** 3 steps for live apps. */
  howItWorks?: string[]
  /** What to expect, for coming-soon apps. */
  soonNote?: string
  /** Permissions / device requirements worth surfacing. */
  deviceNote?: string
  /** Live apps to suggest instead, for coming-soon apps. */
  relatedLive?: string[]
}

export interface CategoryDef {
  id: AppCategory
  label: string
  purpose: string
  icon: string
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'communicate', label: 'Communicate', purpose: 'Calls, meetings, classrooms', icon: 'video' },
  { id: 'share', label: 'Share', purpose: 'Files, clipboard, devices', icon: 'transfer' },
  { id: 'collaborate', label: 'Collaborate', purpose: 'Whiteboards, documents, screens', icon: 'brush' },
  { id: 'remote', label: 'Remote Access', purpose: 'Assistance and device utilities', icon: 'help' },
  { id: 'utilities', label: 'Utilities', purpose: 'Walkie-talkie, camera, recording', icon: 'radio' },
  { id: 'productivity', label: 'Personal Productivity', purpose: 'Phone as webcam, mic, remote', icon: 'smartphone' },
]

export const APPS: AppDef[] = [
  // ------------------------------------------------------------------ share
  {
    id: 'beam',
    name: 'Beam',
    category: 'share',
    status: 'live',
    tagline: 'Send text and links from one device to another, instantly.',
    description:
      'Type or paste anything (a link, an address, a Wi-Fi password, a half-written draft) and it appears on your other devices the moment you send it. No emailing yourself, no chat app clutter, no account.',
    icon: 'zap',
    intents: [
      'send text to my computer',
      'copy from phone to pc',
      'share a link between devices',
      'clipboard sharing',
      'send a wifi password to a guest',
      'transfer notes between devices',
      'text myself',
      'paste across devices',
      'share text between devices',
      'send link to laptop',
    ],
    features: [
      'Text appears instantly on every device in the session',
      'Paste straight from your clipboard with one tap',
      'One-tap copy on the receiving device',
      'History exists only while the session lives',
      'Works between phones, tablets and computers',
    ],
    howItWorks: [
      'Create a session on the device that has the text',
      'Open the same session on the other device: scan the QR code or type the 6-character code',
      'Send. It is already there.',
    ],
    deviceNote:
      'The Paste button uses your browser clipboard only when you tap it. Your browser will ask for permission first.',
  },
  {
    id: 'drop',
    name: 'Drop',
    category: 'share',
    status: 'live',
    tagline: 'Move files between your phone and your computer without uploading them anywhere.',
    description:
      'Drag in photos, documents, recordings (up to 50 MB per file) and they land directly on the other device in the session. Files travel through the live session and are discarded when it ends; nothing sits in cloud storage.',
    icon: 'transfer',
    intents: [
      'send photos from my phone to my laptop',
      'transfer files phone to pc',
      'send files without uploading',
      'airdrop alternative',
      'send a pdf to my computer',
      'file transfer between devices',
      'send pictures to my computer',
      'move files without a cable',
      'share large files directly',
      'pc to pc transfer',
    ],
    features: [
      'Phone to computer, computer to phone, or any mix of devices',
      'Up to 50 MB per file, no compression, no re-encoding',
      'Live progress for sending and receiving',
      'Image previews before you download',
      'Files vanish when the session ends',
    ],
    howItWorks: [
      'Create a session; start it on either device',
      'Open it on the other device with the QR code or the 6-character code',
      'Drag files in. They transfer immediately with live progress.',
    ],
    deviceNote:
      'Keep the tab open on both devices while a transfer runs. If the connection dips, ShareOnWeb reconnects and you can resend any file.',
  },
  {
    id: 'folder-share',
    name: 'Folder Share',
    category: 'share',
    status: 'live',
    tagline: 'Hand over an entire folder, not one file at a time.',
    description:
      'Pick a folder (project files, photo albums, a batch of documents) and the whole structure lands on the other device exactly as it left: nested folders included. Download everything back as a single ZIP, or grab files one by one. Up to 50 MB per file, nothing stored after the session.',
    icon: 'folder',
    intents: [
      'share a folder between devices',
      'transfer a whole folder',
      'move a project folder to my laptop',
      'send many files at once',
      'copy photo album from phone to pc',
      'send a folder without zipping it first',
      'hand over a project folder',
      'folder transfer between devices',
      'move documents folder to new computer',
      'send multiple files with structure',
    ],
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
    category: 'share',
    status: 'live',
    howItWorks: [
      'Open Quick Pair here and scan the QR with your other device',
      'The devices pair instantly, with no codes to type',
      'Send text and files back and forth from one surface',
    ],
    tagline: 'Pair two devices with a QR code and share anything between them.',
    description:
      'Scan once and the two devices stay paired for the session. Then beam text, files or links without re-entering codes.',
    icon: 'qr',
    intents: ['pair devices with qr code', 'connect phone and laptop', 'qr device pairing'],
    features: [
      'Scan-to-pair in one step',
      'Paired devices get a persistent transfer surface',
      'Unpair instantly or let the session expire',
    ],
  },

  // ------------------------------------------------------------ collaborate
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
    id: 'shared-docs',
    name: 'Notepad',
    category: 'collaborate',
    status: 'live',
    tagline: 'Write the same note together, live.',
    description:
      'Open one shared note on every device: meeting notes, a packing list, a draft you are shaping together. Everything you type appears for the others within a moment, and the whole note disappears when the session ends.',
    icon: 'doc',
    intents: ['shared document editing', 'collaborative notes', 'write together online'],
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
    deviceNote: 'Works with any keyboard or touch screen. No account, no install.',
  },
  {
    id: 'code-editor',
    name: 'Pair Code Editor',
    category: 'collaborate',
    status: 'live',
    howItWorks: [
      'Paste or type your code, and it syncs as you edit',
      'Share the code and pick the language for highlighting',
      'Snapshots let you restore any earlier version',
    ],
    tagline: 'Edit the same code with someone, with zero setup.',
    description:
      'Paste a snippet or open a small project, share a code, and pair-program in the browser with syntax highlighting.',
    icon: 'code',
    intents: ['collaborative code editor', 'pair programming online', 'share code snippet live'],
    features: ['Syntax-aware editing', 'Follow-my-cursor mode', 'Snippet history for the session'],
  },
  {
    id: 'live-present',
    name: 'Live Presentation',
    category: 'collaborate',
    status: 'live',
    howItWorks: [
      'Add slides as images, and everyone follows your page automatically',
      'Share the code with your audience',
      'They watch and react while you keep the pointer and the pace',
    ],
    tagline: 'Present slides while everyone watches and reacts in real time.',
    description:
      'Share a deck or a board, keep everyone on the same slide, and let them react: a webinar room for small groups.',
    icon: 'slides',
    intents: ['live presentations', 'present slides online', 'follow along presentation'],
    features: ['Everyone stays on the presenter\'s slide', 'Lightweight reactions', 'Works straight from the browser'],
  },

  // -------------------------------------------------------------- communicate
  {
    id: 'video-call',
    name: 'Private Call',
    category: 'communicate',
    status: 'live',
    howItWorks: [
      'Start the call and allow camera + microphone',
      'Share the link, and the other person clicks to join',
      'Talk face to face; end the call any time',
    ],
    tagline: 'Talk face to face with one person, straight from the browser.',
    description:
      'A one-to-one video call with a shareable link. No app install, no contact list, no account on either side.',
    icon: 'video',
    intents: ['private video call', 'one to one video call', 'video call without app'],
    features: ['Peer-to-peer video when possible', 'Simple mute and camera controls', 'Link expires with the session'],
    deviceNote: 'Asks for camera and microphone permission before starting, with a pre-call device check.',
  },
  {
    id: 'group-meeting',
    name: 'Group Meeting',
    category: 'communicate',
    status: 'live',
    howItWorks: [
      'Start the meeting room',
      'Invite the team by link, QR or code',
      'Talk, share screens and react; the room vanishes when done',
    ],
    tagline: 'Get the whole team into one video room in seconds.',
    description: 'Small-group video meetings with a temporary room that disappears when you are done.',
    icon: 'users',
    intents: ['group video meeting', 'team video call', 'temporary meeting room'],
    features: ['Temporary rooms, nothing persists', 'Screen sharing built in', 'Join by link, QR or code'],
  },
  {
    id: 'audio-call',
    name: 'Voice Call',
    category: 'communicate',
    status: 'live',
    howItWorks: [
      'Start the voice call',
      'Share the code or link',
      'Talk as long as you like: audio only, easy on data',
    ],
    tagline: 'Audio-only calls when video is not needed, light and instant.',
    description: 'A low-bandwidth voice call for spotty connections and long conversations.',
    icon: 'phone',
    intents: ['audio only call', 'voice call online', 'call without video'],
    features: ['Tiny bandwidth footprint', 'Great on weak mobile networks', 'Same one-click join model'],
  },
  {
    id: 'interview-room',
    name: 'Interview Room',
    category: 'communicate',
    status: 'live',
    howItWorks: [
      'Open the room and start your camera',
      'Send the candidate the link (one click, no account)',
      'Take private notes on your side; the room self-destructs',
    ],
    tagline: 'A quiet, temporary room for interviews with a shareable link.',
    description: 'A purpose-built call room for interviews: candidate link, note space, and a room that self-destructs.',
    icon: 'briefcase',
    intents: ['interview room online', 'candidate video interview', 'temporary interview link'],
    features: ['Candidate joins with one click, no account', 'Private notes pane for the interviewer', 'Room expires automatically'],
  },
  {
    id: 'classroom',
    name: 'Online Classroom',
    category: 'communicate',
    status: 'live',
    howItWorks: [
      'Open the classroom; as the starter, you are the teacher',
      'Students join with the class code',
      'They raise hands and react; you spotlight who is on stage',
    ],
    tagline: 'Teach a class live, with hands raised and shared material.',
    description: 'A teacher-first room: students join by code, hands go up, material is shared on screen.',
    icon: 'school',
    intents: ['online classroom', 'teach online live', 'virtual classroom'],
    features: ['Student hand-raise queue', 'Teacher-controlled sharing', 'Join by 6-character class code'],
  },
  {
    id: 'webinar-room',
    name: 'Webinar Room',
    category: 'communicate',
    status: 'live',
    howItWorks: [
      'Start the webinar; you are the presenter',
      'Viewers join muted by link or code',
      'They chat, react and raise hands while you present',
    ],
    tagline: 'Present to many, with viewers muted by default.',
    description: 'One presenter, many viewers: questions via chat, polls for instant feedback.',
    icon: 'presentation',
    intents: ['webinar room', 'present to many people', 'livestream to a small group'],
    features: ['Presenter controls', 'Viewers join as read-only', 'Built-in polls and Q&A'],
  },
  {
    id: 'screen-share',
    name: 'Screen Sharing',
    category: 'communicate',
    status: 'live',
    tagline: 'Show your screen to someone, live and straight from the browser.',
    description:
      'Pick a screen, a window or a browser tab and it streams directly to every other device in the session. The video travels browser-to-browser: no server in the middle, nothing recorded, and the share dies with the session.',
    icon: 'monitor',
    intents: [
      'screen sharing session',
      'show my screen',
      'share my screen with someone',
      'present my screen live',
      'remote support screen share',
      'show a customer something on my screen',
    ],
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
    deviceNote:
      'Your browser\'s share picker decides what is shared, and nothing streams before you pick. Some strict corporate networks block direct video; if so the connection status says so instead of failing silently.',
  },

  // ------------------------------------------------------------------ remote
  {
    id: 'remote-assist',
    name: 'Remote Assist',
    category: 'remote',
    status: 'live',
    howItWorks: [
      'The person needing help joins with the code',
      'They pick “I need help” and approve your view request',
      'You see their screen and draw to guide them',
    ],
    tagline: 'Help someone by seeing their screen and guiding them.',
    description:
      'The classic "help my parents fix their computer" flow: they open a link, read you a code, and you see their screen to walk them through it.',
    icon: 'help',
    intents: [
      'remote assistance',
      'help someone fix their computer remotely',
      'view another person\'s screen',
      'remote support for parents',
      'remote technical support session',
    ],
    features: ['They click one link; no install, no account', 'You guide; they stay in control', 'Annotate to point things out'],
  },
  {
    id: 'co-browse',
    name: 'Collaborative Browsing',
    category: 'remote',
    status: 'live',
    howItWorks: [
      'Paste the page you want to visit together',
      'Everyone follows in one click',
      'Turn on pointer mode to show each other what matters',
    ],
    tagline: 'Browse the same page together and point at things.',
    description: 'Open a page together, with synced scrolling, a shared pointer, and markers everyone can see.',
    icon: 'pointer-click',
    intents: ['collaborative browsing', 'browse together online', 'show someone a website'],
    features: ['Synced page and scroll position', 'Shared cursor', 'One-click link sharing'],
  },
  {
    id: 'guided-pointer',
    name: 'Shared Pointer & Markup',
    category: 'remote',
    status: 'live',
    howItWorks: [
      'Join as the helper and request to view their screen',
      'They approve, and their screen appears here',
      'Point and annotate live so “click there” finally means something',
    ],
    tagline: 'Point at and annotate what is on someone else\'s screen.',
    description: 'A layer on top of screen sharing: draw on the shared screen so "click there" finally means something.',
    icon: 'pointer',
    intents: ['annotate someone\'s screen', 'shared mouse pointer', 'point at remote screen'],
    features: ['Laser pointer on the shared view', 'Annotations fade or persist', 'Only the helper can mark up'],
  },
  {
    id: 'support-session',
    name: 'Support Session',
    category: 'remote',
    status: 'live',
    howItWorks: [
      'Open the session and the customer joins by code',
      'Request view access and list the fix steps',
      'Work through the steps; the session logs itself until it expires',
    ],
    tagline: 'Structured remote technical support with join codes.',
    description: 'For teams helping customers: a ticket-shaped session with steps, notes and a clean ending.',
    icon: 'lifesaver',
    intents: ['remote support session', 'customer support screen share', 'it helpdesk session'],
    features: ['Session transcript of steps taken', 'Consent prompt before viewing', 'Ends cleanly, expires automatically'],
  },

  // --------------------------------------------------------------- utilities
  {
    id: 'walkie-talkie',
    name: 'Walkie-Talkie',
    category: 'utilities',
    status: 'live',
    howItWorks: [
      'Everyone joins with the code',
      'Hold the big button (or the Space bar) and talk',
      'Release and someone else takes a turn',
    ],
    tagline: 'Push-to-talk voice across devices, like a real walkie-talkie.',
    description: 'Hold a button, talk, release. Everyone in the session hears you instantly.',
    icon: 'radio',
    intents: ['browser walkie talkie', 'push to talk online', 'voice chat for a group nearby'],
    features: ['Push-to-talk, no accidental open mics', 'Works phone to phone to PC', 'Instant join by code'],
    deviceNote: 'Asks for microphone permission with a pre-talk check.',
  },
  {
    id: 'voice-record',
    name: 'Voice Recorder',
    category: 'utilities',
    status: 'live',
    tagline: 'Record audio and share it live as you speak.',
    description: 'A recorder whose output streams to the session, great for interviews, voice memos and quick notes.',
    icon: 'mic',
    intents: ['voice recorder with live sharing', 'record audio and share', 'live voice memo'],
    features: ['Records while streaming to listeners', 'Downloadable copy at the end', 'Session-scoped, then gone'],
    howItWorks: [
      'Start recording and everyone in the session hears you live',
      'Speak; the level meter confirms you are heard',
      'Stop and the audio downloads. Then it is gone.',
    ],
    deviceNote: 'Asks for microphone permission before recording starts.',
  },
  {
    id: 'camera-live',
    name: 'Live Camera',
    category: 'utilities',
    status: 'live',
    howItWorks: [
      'Start sharing your camera',
      'Others open the code on any device to watch live',
      'Viewers can take snapshots; the stream ends with the session',
    ],
    tagline: 'Share what your camera sees, live, with a link.',
    description: 'Point your camera at something and let others watch through a temporary session.',
    icon: 'camera',
    intents: ['live camera sharing', 'show my camera live', 'share what i see'],
    features: ['Watch from any device with the code', 'Snapshot button for viewers', 'Stream ends with the session'],
    deviceNote: 'Asks for camera permission first; nothing is recorded by default.',
  },
  {
    id: 'baby-monitor',
    name: 'Baby & Pet Monitor',
    category: 'utilities',
    status: 'live',
    howItWorks: [
      'On the watching device: open the session',
      'On the camera device: tick consent and start',
      'If the feed ever drops, the watching device alerts loudly',
    ],
    tagline: 'Keep an eye on things with secure, consent-first monitoring.',
    description: 'One device watches, another listens in: explicit consent on the watching device, loud disconnect alerts and automatic expiry.',
    icon: 'baby',
    intents: ['baby monitor online', 'pet camera', 'monitor a room from another device'],
    features: ['Explicit on-screen consent on the camera device', 'Alerts when the connection drops', 'Always expires, never a permanent feed'],
  },
  {
    id: 'temp-stream',
    name: 'Temporary Live Stream',
    category: 'utilities',
    status: 'live',
    tagline: 'Stream live for a short while, then it is gone.',
    description: 'A lightweight, self-destructing stream for events, show-and-tell and quick broadcasts.',
    icon: 'tower',
    intents: ['temporary live streaming', 'small live stream', 'stream an event to friends'],
    features: ['Viewer link that expires', 'No VOD, no archive', 'Simple start/stop controls'],
    howItWorks: [
      'Go live, and your camera and mic broadcast to every viewer',
      'Share the viewer link or code',
      'Stop when done; nothing is archived or replayed',
    ],
  },
  {
    id: 'location-share',
    name: 'Live Location',
    category: 'utilities',
    status: 'live',
    howItWorks: [
      'Pick how long to share, then tap the button',
      'Others see where you are, with a visible countdown',
      'Stop instantly, or let it expire on its own',
    ],
    tagline: 'Share where you are for a limited time, only if you choose to.',
    description: 'Opt-in location sharing that always has an end time, for meetups and "almost there" moments.',
    icon: 'mappin',
    intents: ['live location sharing', 'share my location temporarily', 'opt-in location'],
    features: ['Always time-limited', 'You choose who sees it', 'One tap to stop'],
  },
  {
    id: 'live-captions',
    name: 'Live Captions & Translation',
    category: 'utilities',
    status: 'live',
    howItWorks: [
      'Start listening; captions appear in the shared feed',
      'Everyone reads along, live',
      'Turn on translation to read the room in your language',
    ],
    tagline: 'Real-time captions and translation for any conversation.',
    description: 'Speak in one language and everyone reads captions in theirs, for classes, calls and cross-language chats.',
    icon: 'captions',
    intents: ['real time translation', 'live captions', 'translate a conversation live'],
    features: ['Live captions in the room', 'Per-viewer language choice', 'Works with any live tool later'],
  },

  // ------------------------------------------------------------- productivity
  {
    id: 'phone-webcam',
    name: 'Phone as Webcam',
    category: 'productivity',
    status: 'live',
    howItWorks: [
      'Open this session on your phone and allow the camera',
      'Your phone’s video appears on the computer',
      'Front or back lens, your call',
    ],
    tagline: 'Use your phone\'s camera as a wireless webcam for your computer.',
    description: 'Your phone becomes the camera your computer uses: better optics than most built-ins, zero cables.',
    icon: 'webcam',
    intents: ['use phone as webcam', 'phone camera for pc', 'wireless webcam'],
    features: ['Video appears on your PC through the browser', 'Front or back camera switch', 'Battery-friendly streaming'],
    deviceNote: 'Asks for camera permission on the phone only.',
  },
  {
    id: 'phone-mic',
    name: 'Phone as Microphone',
    category: 'productivity',
    status: 'live',
    howItWorks: [
      'Open this session on your phone and allow the microphone',
      'Your phone’s audio plays on the computer',
      'The level meter confirms the signal',
    ],
    tagline: 'Turn your phone into a wireless microphone for your PC.',
    description: 'Recordings, calls and meetings that pick up your phone\'s mic, across the room if needed.',
    icon: 'audiolines',
    intents: ['use phone as microphone', 'phone mic for pc', 'wireless microphone'],
    features: ['Low-latency audio to your computer', 'Input level meter', 'Stop when the session ends'],
    deviceNote: 'Asks for microphone permission on the phone only.',
  },
  {
    id: 'presentation-clicker',
    name: 'Presentation Remote',
    category: 'productivity',
    status: 'live',
    howItWorks: [
      'On the computer: open the session as the stage and load slides',
      'On the phone: join the same code and it becomes the remote',
      'Tap next / back / blank while the projector does the rest',
    ],
    tagline: 'Use your phone to control the slides on your computer.',
    description: 'Next, back and laser pointer from your phone while your computer drives the projector.',
    icon: 'smartphone',
    intents: ['phone as remote presentation controller', 'clicker for slides', 'control slides from phone'],
    features: ['Next / back / blank from the phone', 'Slide preview on the phone', 'Pairs by code in one tap'],
  },
  {
    id: 'screen-to-phone',
    name: 'Screen on Phone',
    category: 'productivity',
    status: 'live',
    howItWorks: [
      'Start sharing your screen here',
      'Open the code on your phone',
      'Keep a live glance at your computer in your pocket',
    ],
    tagline: 'See your computer screen on your phone, as a second glance.',
    description: 'Keep your PC screen in your pocket and check the build, the slide notes or the chat without running back.',
    icon: 'monitorsmartphone',
    intents: ['share pc screen with phone', 'see my computer screen on my phone', 'second screen glance'],
    features: ['One-way screen view on the phone', 'Auto-refreshing, low data', 'Ends with the session'],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getApp(id: string): AppDef | undefined {
  return APPS.find((a) => a.id === id)
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
  productivity: '#0d9488',
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
]

/** Curated one-click set for the Discover hero + header menu (do-it-first). */
export const INSTANT_START_APPS = [
  'beam',
  'drop',
  'video-call',
  'screen-share',
  'folder-share',
  'roundtable',
  'audio-call',
  'walkie-talkie',
]

/** Simple intention-first search across name, tagline and intents. */
export function searchApps(query: string): AppDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const words = q.split(/\s+/)
  const scored: { app: AppDef; score: number }[] = []
  for (const app of APPS) {
    const haystacks = [
      app.name.toLowerCase(),
      app.tagline.toLowerCase(),
      app.description.toLowerCase(),
      app.intents.join(' ').toLowerCase(),
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
    if (haystacks[3].split(' ').some((w) => words.includes(w))) score += 1
    if (score > 0) scored.push({ app, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || (a.app.status === 'live' ? -1 : 1))
    .slice(0, 6)
    .map((s) => s.app)
}
