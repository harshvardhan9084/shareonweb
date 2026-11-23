import type { AppArticle } from '@/lib/article-types'

// Long-form articles for the 12 live (session) tools. Facts are drawn from
// the implementations, not invented: session expiry, peer-to-peer media,
// variant behavior, honest limits.

export const LIVE_ARTICLES: Record<string, AppArticle> = {
  // ------------------------------------------------------------------ share
  share: {
    lede: [
      'Share is the everything-transfer tool. Paste a link on your phone and it lands on your laptop. Drag in photos and they arrive as you drop them. Hand over a whole folder with its structure intact. One session does all of it, because text, files and folders live side by side in the same room and one code covers every mode.',
      'The transfers do not pass through an upload form or a storage bucket. They travel through the live session itself, device to device, and when the session ends the content is discarded. Nothing was ever held on our side to begin with.',
    ],
    sections: [
      {
        heading: 'How a transfer actually happens',
        paragraphs: [
          'Create a session on the device that has the content. The page opens a room and shows its six-character code, a QR code and a join link. Open the same room on the other device by any of the three. From that moment the two devices are connected directly: what you send appears on the other side within a moment, with live progress for every file.',
          'Text works the same way. Type or paste it on one device and it is already on the other, ready to copy. Quick Pair collapses even that: scan the QR with your phone and the devices stay paired for the whole session, one surface for text and files with no codes to retype.',
          'If the connection dips mid-transfer, the session reconnects and you can resend anything that did not land. Keep both tabs open while a transfer runs; that is the only requirement.',
        ],
      },
      {
        heading: 'When it beats the usual way',
        paragraphs: [
          'The usual route from phone to computer is a detour: email the file to yourself, upload to a cloud drive, plug in a cable, or install an app that asks for an account before it moves a single photo. Each detour puts your file on somebody else\u2019s server and costs you minutes.',
          'Share fits the moments those detours ruin:',
        ],
        list: [
          'Send a photo from your phone to your laptop while sitting at the same table',
          'Move a PDF, a recording or a zip without uploading it anywhere',
          'Copy a long Wi\u00AD-Fi password or a booking reference across in one tap',
          'Hand a whole project folder to someone with the structure rebuilt exactly',
          'Pair two devices once and share back and forth all evening',
        ],
      },
      {
        heading: 'What happens to your content',
        paragraphs: [
          'Files go from the sending device to the receiving device through the session. They are not parked on a server, scanned, indexed or backed up. There is no storage bucket holding them and no profile attaching a name to them, because the platform has neither.',
          'When the session ends, by closing it, by the 24-hour expiry, or by just walking away, the content ceases to exist. The session record on the relay expires and nothing readable is left behind.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Files transfer at up to 50 MB each, with no compression and no re-encoding: what arrives is byte-for-byte what was sent. Folders keep their nested structure, and the receiving side can download everything back as one ZIP rebuilt in that structure.',
          'Recent rooms for this tool are kept on the device only, so a mistaken back-click never strands you. The Paste button uses your browser clipboard only when you tap it, and your browser asks permission first.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- call
  call: {
    lede: [
      'Call is one room that takes every shape a conversation needs. A two-person video call. A team meeting with screens shared. An audio-only talk that is gentle on a weak network. An interview with a private notes pane. A classroom with raised hands. A webinar with the audience muted. Same tool, same one-click join.',
      'Everyone arrives from a browser with a link, a QR or a six-character code. No account for you, no account for them. Media flows device to device wherever the networks allow, nothing is recorded, and the room disappears when you close it.',
    ],
    sections: [
      {
        heading: 'How a room works',
        paragraphs: [
          'Pick the shape of the conversation and start the room. One click creates it and shows the code, the QR and the link. Everyone you invite clicks, scans or types, and they are in, straight from whatever browser they already have. The mode picker on the landing page sets the room\u2019s roles before anyone joins: presenter and viewers for a webinar, teacher and students for a class, plain equals for a call.',
          'Video and audio stream peer to peer when the networks allow, which keeps latency low and keeps the media off other people\u2019s servers. On weak connections, voice-only mode carries the conversation on a fraction of the data. Hand-raise, spotlight and reactions give a group its manners; chat exists in every room.',
          'Before the first camera turns on there is a device check, so a dead microphone is caught before the meeting starts, not five minutes into it. You can join with camera and mic off and enable them later.',
        ],
      },
      {
        heading: 'When it is the right room',
        paragraphs: [
          'Most call tools make you choose before you have thought: an account, an installed app, a meeting that lives forever in a calendar grid. Call fits the conversations that start now and end soon.',
        ],
        list: [
          'A face-to-face call with one person, from a link you paste into a message',
          'A team huddle with screens shared, gone by lunchtime',
          'An audio call on mobile data where video would stutter',
          'An interview where you take private notes the candidate never sees',
          'A class where students raise hands and you spotlight who speaks',
          'A webinar where the audience watches muted and reacts live',
        ],
      },
      {
        heading: 'What happens to the conversation',
        paragraphs: [
          'The video and audio travel between the devices in the room. There is no recording infrastructure, no cloud DVR, no transcript stored anywhere. What is said in the room exists only in the room.',
          'Rooms expire on their own. End it when the conversation is over and the room ceases to exist; the code stops working and nothing of the call remains to find.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'The browser will ask for camera and microphone permission before you start, and you control each independently during the call. Interview rooms keep a notes pane private to your side. Classroom and webinar modes give the starter real presenter controls: spotlight, muting and the hand-raise queue.',
          'Rooms are temporary by design: 24 hours at the longest, or end them sooner. If a network blocks direct video, the connection status says so plainly instead of failing silently.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ screen
  screen: {
    lede: [
      'Screen is every screen-to-screen moment in one tool. Share a tab, a window or your whole screen with someone. Keep your computer screen in your pocket by watching it on your phone. Walk a parent through a fix by seeing their screen. Annotate live so \u201Cclick there\u201D finally means something. Run a support session with steps and consent.',
      'The video travels browser to browser. There is no server in the middle recording the stream, nothing is captured for later, and the share dies the moment the session does.',
    ],
    sections: [
      {
        heading: 'How sharing works',
        paragraphs: [
          'Create a session on the device doing the sharing. On the other device, scan the QR or type the six-character code. Press \u201CShare my screen\u201D and your browser shows its own picker: whole screen, one window, or one tab. Nothing streams before you pick, and you can stop with one tap, from the page or from the browser\u2019s own bar.',
          'The other direction works the same way. The person who needs help joins with the code, picks \u201CI need help\u201D and approves your view request. Their screen appears on your side, view-only: you guide, they stay in control of their own machine. A laser pointer and annotations can be drawn on the shared view so instructions land precisely.',
          'Optional system audio comes through too, so a video playing on the shared screen is heard, not just seen.',
        ],
      },
      {
        heading: 'When it beats installing something',
        paragraphs: [
          'Remote-help tools usually want an install on both ends and an account in the middle. Screen fits the moments when neither should be necessary.',
        ],
        list: [
          'Show a colleague exactly what you see instead of describing it',
          'Keep an eye on your computer from your phone across the room',
          'Talk a parent through a setting while you watch their screen',
          'Point at and mark up what is on someone else\u2019s screen, live',
          'Run a structured support session with a transcript of the steps taken',
        ],
      },
      {
        heading: 'What happens to the stream',
        paragraphs: [
          'The screen video goes directly from one browser to the other. It is not recorded, transcribed or stored. There is no replay to watch later, which is the point: the stream exists while it is happening and stops existing when the session ends.',
          'Consent is built in before any viewing starts, and support sessions keep a step log so both sides know what was done. When the session expires, the log and the connection both end.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'What can be shared is decided by your browser\u2019s own picker, not by us. Phone screens can be watched on a computer, and computer screens can be watched on a phone, one-way and live. Some strict corporate networks block direct video; when that happens the connection status says so honestly instead of failing silently.',
          'Remote assist is view-only by design: nobody takes over anyone else\u2019s keyboard or mouse. The person being helped stays in control the entire time.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ camera
  camera: {
    lede: [
      'Camera aims the devices you already own. Stream what your camera sees to another device. Use your phone as a wireless webcam for your computer. Turn two devices into a consent-first monitor for a baby, a pet or a room. Go live for a short while and let the stream disappear behind you.',
      'Feeds run device to device through the session and end with it. There is no cloud archive of what your camera saw, no default recording, no footage of your living room stored on anybody\u2019s disk.',
    ],
    sections: [
      {
        heading: 'How a feed works',
        paragraphs: [
          'Pick the job first: live camera, webcam, monitor or stream. Start the session on the camera device and allow the camera permission. Everyone else watches live with the code, the link or the QR. The camera device decides when it is on, and one tap stops it.',
          'As a webcam, your phone opens the session and its video appears on your computer, front or back lens, with no cable and no driver to install. As a monitor, one device watches while another listens in, and the camera device must tick an explicit consent before anything starts.',
          'The monitor mode is built around failure being loud: if the feed ever drops, the watching device alerts loudly rather than showing you a silent stale frame.',
        ],
      },
      {
        heading: 'When it is the right camera',
        paragraphs: [
          'A webcam that needs a driver, a monitor that needs an account and a cloud subscription, a stream that gets archived forever: each solves the wrong problem. Camera fits the moments that are live, temporary and yours.',
        ],
        list: [
          'Show a machine, a whiteboard or a room to someone far away',
          'Use the good camera in your pocket for the video call on your computer',
          'Check on a sleeping baby from another room, with consent up front',
          'Watch the dog while you are out for an hour, then stop',
          'Stream a small event to friends with nothing kept afterwards',
        ],
      },
      {
        heading: 'What happens to the video',
        paragraphs: [
          'The feed goes from the camera device to the watching devices in the session, live. It is not recorded by default, and viewer snapshots exist only where they help, taken by the viewer on their own device.',
          'When the session ends the feed ends with it. There is no replay, no archive, no library of past streams. A camera session that expires is a camera session that no longer exists anywhere.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Camera permission is asked on the device sharing its lens, and nowhere else. Some phones pause video when the screen locks, so keep the camera device plugged in and the tab open for anything long-running.',
          'Consent-first is not decoration in monitor mode: the camera device must explicitly agree before the feed starts, and the watching device announces itself loudly if the connection breaks. A feed that always expires is also a feed that can never be quietly re-watched later.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- voice
  voice: {
    lede: [
      'Voice shapes audio for the moment. Hold a button and talk like a real walkie-talkie. Turn your phone into a proper microphone for your computer across the room. Record while everyone in the session listens live, and grab the file at the end.',
      'Everything streams through the session and disappears when it ends. No cloud recorder holds your audio, no account is asked for, and the microphone is never open by accident.',
    ],
    sections: [
      {
        heading: 'How it sounds',
        paragraphs: [
          'Walkie-talkie mode is push-to-talk: hold the big button, or the space bar on a keyboard, and talk. Release and someone else takes a turn. Nothing is transmitted while you are not holding it, which is what keeps a group of people usable without an open-mic mess.',
          'Phone-as-microphone streams your phone\u2019s mic to your computer at low latency, with a level meter confirming the signal. It usually sounds better than the laptop mic it replaces, and it works across the room with no cable.',
          'Recorder mode does two things at once: it records while streaming your voice to listeners in the session, and when you stop, the recording downloads to your device and the audio in the session is gone.',
        ],
      },
      {
        heading: 'When it is the right mic',
        paragraphs: [
          'Sound gear is heavy before you even need it: an account, a room code from a meeting product, a recording that uploads itself somewhere. Voice fits the moments that need audio and nothing else.',
        ],
        list: [
          'A group in the same building that wants push-to-talk right now',
          'A better microphone for a call, from the phone already in your hand',
          'Record a voice memo while a friend listens live from another device',
          'Grab the recording as a file, then let everything else vanish',
        ],
      },
      {
        heading: 'What happens to the audio',
        paragraphs: [
          'Audio streams through the session to the devices in it. The only copy that can outlive the session is the recording you explicitly download in recorder mode, and that file lands on your own device.',
          'There is no server-side recording to subpoena, re-listen to or leak. When the session ends, the audio exists only where you kept it, if you kept it at all.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Microphone permission is asked before any mode starts, with a pre-talk check so the level meter confirms you are heard before it matters. Walkie-talkie works phone to phone to PC in the same room.',
          'Push-to-talk is the whole design: the mic cannot be open by accident. If you need an open conversation instead, the Call tool does full-duplex audio with the same one-click join.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- notepad
  notepad: {
    lede: [
      'Notepad puts one shared buffer on every device. Meeting notes that everyone writes at once. A packing list the whole household edits. A draft you are shaping together. Or a code snippet you are pair-programming, with syntax highlighting and snapshots to roll back to.',
      'What you type appears on the other devices within a moment. When the session ends, the note is gone: there was never a document stored on a server, only text passed between the people writing it.',
    ],
    sections: [
      {
        heading: 'How writing together works',
        paragraphs: [
          'Pick prose or code and start the note. Everyone joins with the code or QR and types. Edits sync as each writer pauses, and when two people type at once the merge is handled safely rather than clobbering one side.',
          'Counts run live as you write: words, characters, lines. Code mode adds syntax-aware editing, a follow-my-cursor mode and snapshots, so you can restore any earlier version of the snippet without leaving the page.',
          'The note can be copied or downloaded as a .txt at any time. That download is the only copy that survives the session, and it is yours, on your device.',
        ],
      },
      {
        heading: 'When it beats a shared document',
        paragraphs: [
          'Shared documents come wrapped in accounts, permissions dialogs and a permanent home in someone\u2019s cloud. Notepad fits the notes that should not outlive the moment they serve.',
        ],
        list: [
          'Take meeting notes with everyone contributing live',
          'Build a packing or shopping list across two phones',
          'Pair on a snippet without setting up a repository',
          'Draft something together for ten minutes and then let it go',
          'Hand a temporary note to a guest who has no account and needs none',
        ],
      },
      {
        heading: 'What happens to the text',
        paragraphs: [
          'The buffer travels through the session between the devices writing it. There is no document ID, no revision history on a server, no search index over what you wrote.',
          'When the session expires the note ceases to exist on our side. Download it or copy it first if you want it; that copy is the only one that will remain.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'It works with any keyboard or touch screen, no install. The two modes share the same session model, so a note and a code session behave the same: join, write, expire.',
          'Snapshots in code mode are session-scoped too. They protect you from a bad edit during the session, not from the session ending, which is the honest trade for having no storage at all.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- present
  present: {
    lede: [
      'Present is the full presenting loop without the upload form. Load slides on your laptop. The audience follows on their phones at full quality. Reactions roll in live. Your phone becomes the clicker with next, back, blank and a laser pointer.',
      'Slides travel through the session, not through a platform\u2019s upload queue. When the presentation ends and the session expires, the deck exists only where it started: on your machine.',
    ],
    sections: [
      {
        heading: 'How presenting works',
        paragraphs: [
          'Add slides on the presenting device. Everyone who joins with the code sees exactly the slide you are on, automatically, at full quality, on whatever screen they brought. No app, no \u201Cjoin from the website\u201D dance: the code or QR is the whole ticket.',
          'Join the same session from your own phone and it turns into the remote: next, back, blank the screen, a preview of the current slide, and a pointer to draw attention during a live presentation.',
          'The audience is not passive. Lightweight reactions come in live, so you can feel the room without reading faces through a webcam.',
        ],
      },
      {
        heading: 'When it fits the room',
        paragraphs: [
          'Webinar platforms want the deck uploaded, converted and hosted before anyone sees a pixel. Present fits the talks that live on your laptop and end when the session does.',
        ],
        list: [
          'Present to a class or a team from your own machine',
          'Let everyone follow along on their own phones instead of squinting at a projector',
          'Walk the room from the back while driving slides from your phone',
          'Give a talk where the deck is never uploaded anywhere',
        ],
      },
      {
        heading: 'What happens to the slides',
        paragraphs: [
          'Slides move through the session to the devices watching. They are not uploaded to a library, not converted on a server, not kept after the room ends.',
          'The deck on your computer is the only copy that persists, which is exactly where a deck should live.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Slides are added as images, which keeps rendering identical on every device and avoids font surprises. The remote shows a preview of the current slide so you always know where the room is.',
          'Presentation mode and phone-remote mode are two faces of one session: the stage shows, the phone controls. If only the remote is needed, both can join by code in one tap.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ canvas
  canvas: {
    lede: [
      'Canvas is one whiteboard under many hands. Strokes appear live on every screen as you draw: sketch an idea during a call, explain a shape to a colleague, or doodle with a kid across town.',
      'Touch, stylus, trackpad and mouse all work. The board lives in the session: when it expires, the drawing is gone unless someone exported it first.',
    ],
    sections: [
      {
        heading: 'How the board works',
        paragraphs: [
          'Create a board and share the code or QR with everyone who should draw. Every stroke syncs as it is drawn, so the sketch grows on all screens together instead of waiting for a save.',
          'The toolset is deliberately small: six colors, an adjustable brush size, an eraser. Undo and clear are synced for everyone, so the board never forks into personal and shared states.',
          'Export the board as a PNG when it is worth keeping. That file lands on the exporter\u2019s device, which is the only place a copy of a temporary board should ever be.',
        ],
      },
      {
        heading: 'When it beats a whiteboard app',
        paragraphs: [
          'Whiteboard products arrive with workspaces, boards-within-boards and a seat license per head. Canvas fits the drawing that needs to happen now and end soon.',
        ],
        list: [
          'Explain an idea visually in the middle of a call',
          'Let two kids draw together from two devices',
          'Sketch a flow with a colleague and export the result',
          'Doodle across a distance without installing anything',
        ],
      },
      {
        heading: 'What happens to the strokes',
        paragraphs: [
          'Strokes pass through the session to the screens drawing on it. There is no gallery of boards, no template library storing your sketch, nothing indexed or backed up.',
          'When the session ends, the board ceases to exist. Export first if it matters; the PNG is yours alone.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Input works with finger, stylus, trackpad and mouse, on phones and desktops alike, which is what makes a kid-on-a-tablet and a colleague-on-a-laptop equal participants.',
          'The board is a canvas, not a diagramming tool: freehand drawing, erasing and color are the vocabulary. That smallness is why it opens in a second and works for a five-year-old.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- roundtable
  roundtable: {
    lede: [
      'Roundtable is a lightweight room for a quick huddle: chat that appears in real time and one-click polls with live result bars. Open it, share the link or code, talk, vote, decide.',
      'No accounts for anyone, no setup, and nothing left behind. When the room expires, the messages and the votes go with it.',
    ],
    sections: [
      {
        heading: 'How a huddle works',
        paragraphs: [
          'Open a room and hand out the link or the six-character code. Chat appears for everyone in real time, and you can see who is in the room and on which device before you say something sensitive.',
          'Polls are one click to create and one click to vote, with result bars updating live. Change your vote any time before the room ends; the last state is the one that counts.',
          'Decisions, then expiry. The room is built to end: let it expire or close it when the huddle is over.',
        ],
      },
      {
        heading: 'When it beats a group chat',
        paragraphs: [
          'Group chats want accounts and leave messages behind for weeks. Roundtable fits the decisions that belong to one afternoon.',
        ],
        list: [
          'Pick where to eat with a quick live poll',
          'Huddle a team for ten minutes without creating a channel',
          'Poll a classroom and show the results live',
          'Give a guest group a room that self-destructs',
        ],
      },
      {
        heading: 'What happens to the conversation',
        paragraphs: [
          'Messages and votes travel through the session between the people in the room. There is no channel history on a server, no searchable archive, no notification system storing what was said.',
          'When the room expires, the conversation is discarded. Screenshot anything worth keeping; the room itself will not remember.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'The room shows its participants, which keeps the huddle honest about who is listening. Polls stay open until the room ends, and vote changes are free.',
          'Roundtable is deliberately not a messaging product: no message history, no direct messages, no presence beyond the room. It is the tool for the conversation that ends.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- co-browse
  'co-browse': {
    lede: [
      'Collaborative Browsing puts everyone on the same page, literally. Synced scrolling, a shared pointer, and one-click link sharing: open a page together and point at what matters.',
      'The page opens on each device directly, through the browser everyone already has. There is no proxy server fetching pages for the group and logging what you looked at.',
    ],
    sections: [
      {
        heading: 'How browsing together works',
        paragraphs: [
          'Paste the page you want to visit together. Everyone in the session follows in one click, and the page loads on their own device from its own origin.',
          'Scroll position stays synced, so when you scroll to the pricing table, the other screens arrive with you. Pointer mode draws a shared cursor so you can show rather than describe.',
          'Links shared inside the session appear one click away, so the tour can move: product page, documentation, comparison, decision.',
        ],
      },
      {
        heading: 'When it beats screen sharing',
        paragraphs: [
          'Screen sharing sends one device\u2019s video to everyone and eats bandwidth. Co-browsing lets each device load the real page, which stays sharp and cheap.',
        ],
        list: [
          'Walk a relative through a website while you both see it crisply',
          'Compare options with a colleague on the same page, pointing at details',
          'Review a design or an article together, page by page',
          'Get a friend to the exact checkout screen you mean',
        ],
      },
      {
        heading: 'What happens to the browsing',
        paragraphs: [
          'Each device fetches the page itself, so there is no middleman recording the URLs the group visited and no copy of anyone\u2019s cookies or logins flowing through us.',
          'The session remembers only where the group is, while it is there. When it expires, the shared pointer and the history of the tour are gone.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Because pages load on each device, logins stay personal: if a page needs an account, each person can use their own, or none. Nothing about your credentials passes through the session.',
          'Pointer mode is one toggle. Turn it off and the screens scroll independently, which is handy once the tour becomes exploration.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------- location-share
  'location-share': {
    lede: [
      'Live Location is opt-in position sharing that always has an end time. Pick how long to share, tap the button, and the people you chose see where you are on one map, with a visible countdown.',
      'You choose the duration, you choose the audience, and one tap stops it early. It is built for \u201Calmost there\u201D moments, not for tracking that never ends.',
    ],
    sections: [
      {
        heading: 'How sharing works',
        paragraphs: [
          'Set the share window and start it. The session opens and everyone who joins with the code or link sees your position plotted live, with the countdown visible so nobody wonders how long this lasts.',
          'Multiple sharers appear on one map, which is what makes a meetup work: everyone can see the group converging instead of reading coordinates aloud.',
          'Stop instantly with one tap, or let the window run out. Both end the sharing completely; there is no lingering last-known-position.',
        ],
      },
      {
        heading: 'When it is the right share',
        paragraphs: [
          'Location tools tend to be always-on, which is precisely why people distrust them. This one is the opposite by construction.',
        ],
        list: [
          'Meet a group at a festival, a market or an unfamiliar station',
          'Let someone watch your approach on a pickup',
          'Share a position for an hour, then have it end by itself',
          'Coordinate without installing a tracker that lives forever',
        ],
      },
      {
        heading: 'What happens to the position',
        paragraphs: [
          'Positions travel through the session to the devices that were invited. There is no history of movement stored on our side, no heatmap of where you have been, no account tying coordinates to a name.',
          'When the window ends or you stop, the sharing ends everywhere at once. Past positions are not retained; the session holds the present moment and nothing else.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'The browser asks for location permission before anything is shared, and the countdown is always visible to the person sharing, not just the watchers.',
          'Sharing is one-way by default: the people watching do not automatically share back. Each participant controls their own window separately.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------ live-captions
  'live-captions': {
    lede: [
      'Live Captions & Translation turns speech into a shared text feed, in real time, with each reader seeing the captions in their own language. Speak in one language and the room reads along in theirs.',
      'It is built for cross-language conversations: a class with mixed languages, a call with a relative, a meeting where half the room thinks in a different tongue. Captions run through the session and end with it.',
    ],
    sections: [
      {
        heading: 'How captioning works',
        paragraphs: [
          'Start listening and captions appear in the shared feed as speech happens. Everyone in the session reads along live; nothing needs to be pasted or emailed afterwards.',
          'Each viewer picks their own language. The feed renders in that choice, so one conversation can be read comfortably by a room that does not share a mother tongue.',
          'The caption stream composes with the other live tools: keep it running beside a call, a classroom or a presentation, and the text keeps up with the talk.',
        ],
      },
      {
        heading: 'When it changes the conversation',
        paragraphs: [
          'Interpretation is scarce and expensive, and muted microphones hide half the room. Captions fit the moments where understanding matters more than polish.',
        ],
        list: [
          'A class where students follow in their own language',
          'A call with family across a language gap',
          'A meeting where one participant reads faster than they hear',
          'An event where captions make the room accessible',
        ],
      },
      {
        heading: 'What happens to the transcript',
        paragraphs: [
          'Captions flow through the session between the devices reading them. There is no stored transcript to export, no archive of what was said, no profile linking speech to a person.',
          'When the session ends, the feed ends. Copy the text out during the session if it is worth keeping; that copy will be the only one.',
        ],
      },
      {
        heading: 'Details worth knowing',
        paragraphs: [
          'Microphone permission is asked before listening starts, and the caption feed is shared: every device in the room sees the same stream, translated per viewer.',
          'Translation quality follows the browser\u2019s own capabilities, and captions are best-effort text of live speech. Treat them as an aid to understanding, not a certified record.',
        ],
      },
    ],
  },
}
