'use client'

import { useState } from 'react'
import { usePlatform } from '@/lib/store'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const TROUBLESHOOTING = [
  {
    title: 'I cannot join a session',
    steps: [
      'Double-check the 6-character code, which looks like K7T-29Q. Codes use letters and numbers but never I, L, O, 0 or 1.',
      'If you followed a link, open it again in a fresh tab.',
      'Both devices need internet access; corporate networks sometimes block live connections.',
    ],
  },
  {
    title: 'The Paste button does nothing in Share',
    steps: [
      'Browsers require permission to read the clipboard. When the permission prompt appears, choose Allow.',
      'If no prompt appears, copy your text again and paste it into the text box manually; sending still works the same way.',
    ],
  },
  {
    title: 'A file is not arriving in Drop',
    steps: [
      'Keep the tab open on both devices until the transfer finishes. The transfer only runs while both are connected.',
      'Files are limited to 50 MB each, and a session holds up to 80 MB of files in total.',
      'If the connection dropped mid-transfer, remove the stuck file and send it again.',
    ],
  },
  {
    title: 'A folder is not arriving in Folder Share',
    steps: [
      'Keep the tab open on both devices; a folder only arrives while every device stays connected.',
      'A session holds up to 80 MB in total and 50 MB per file. Bigger folders need a second session.',
      'If one file is stuck, remove it and drop the folder again. Files already delivered keep their state.',
    ],
  },
  {
    title: 'My camera or microphone is not working in a call',
    steps: [
      'Allow the permission when the browser asks. The address-bar icon shows what is blocked; unblock it and press Start again.',
      'Close other apps that may be holding the camera (Zoom, Meet, Teams all lock the device while in use).',
      'Calls need a second device in the session to connect, so share the code, and the video flows directly browser-to-browser.',
      'On phones, the first lens is the selfie camera; use the switch-camera button to flip to the back one.',
    ],
  },
  {
    title: 'The Baby & Pet Monitor alert did not stop',
    steps: [
      'The loud alert means the camera device dropped, so pick it up and check the screen; a consent tick is required again after a reload.',
      'The alert stops automatically the moment the feed returns.',
      'If the camera device left permanently, end the session. Monitors always expire, never run in the background.',
    ],
  },
  {
    title: 'Live Location shows “permission blocked”',
    steps: [
      'Location is strictly opt-in: allow it in the browser’s address-bar icon, then press Share again.',
      'Sharing always has a visible countdown and stops on its own, or stop it instantly from your status card.',
      'Indoor GPS is weak; the accuracy number tells you how precise the current fix is.',
    ],
  },
  {
    title: 'Live Captions does not hear me',
    steps: [
      'Automatic captions need Chrome, Edge or Safari; other browsers can still type caption lines manually.',
      'Chrome restarts its listener every minute or so; Kontivo restarts it for you, just keep the tab in the foreground.',
      'Translation runs per viewer. Turn on “Also translate for me” and pick your language; the original stays on the feed.',
    ],
  },
  {
    title: 'I lost my session',
    steps: [
      'Check My Sessions, which lists recent sessions on this device with their codes and titles.',
      'Give sessions a title (from the session toolbar) so they are easy to recognize here.',
      'If someone else created the session, ask them for the code again from their Share panel.',
      'Sessions end 24 hours after they start, or sooner if a participant ends them.',
    ],
  },
]

const FAQ = [
  {
    q: 'Do I need an account?',
    a: 'No. You never sign up or log in. A session is created on demand and identified only by its code. Your name in a session is optional and stored only on your own device.',
  },
  {
    q: 'How long does a session live?',
    a: 'Sessions expire 24 hours after they are created. Any participant can end a session earlier, and everyone is notified and everything inside is discarded.',
  },
  {
    q: 'Who can join my session?',
    a: 'Whoever has the code, the QR code or the link. That is the entire access control: share the code only with people who should be in the room, and end the session when you are done.',
  },
  {
    q: 'Where do my files and text go?',
    a: 'Through the live session, from one of your devices to the others. Nothing is written to a server disk; when the session ends or expires, everything is discarded. Temporary by construction, not by policy.',
  },
  {
    q: 'Is it encrypted?',
    a: 'Traffic runs over HTTPS/WSS, so it is encrypted in transit. Kontivo never stores your content after a session ends. Full end-to-end encrypted peer-to-peer (for video and large files) is on the roadmap.',
  },
  {
    q: 'Why did the connection drop?',
    a: 'Backgrounded tabs and network switches (like leaving Wi-Fi for mobile data) can interrupt the connection. Kontivo reconnects automatically and puts you back into the session with its full history.',
  },
  {
    q: 'Does it work on mobile?',
    a: 'Yes, every tool is mobile-first. Features that use your camera, microphone or clipboard always ask permission first and show what they need before starting.',
  },
  {
    q: 'How do I name a session?',
    a: 'In a live session, tap “Add a title” next to the tool name and type a short label. It helps everyone recognize the session when joining, and it shows in My Sessions on this device.',
  },
  {
    q: 'Is there a faster way to start things?',
    a: 'Press ⌘K (or Ctrl+K) anywhere on Kontivo: the command palette can start any tool, join a session by code, or jump to any page without touching the mouse.',
  },
  {
    q: 'Can I install Kontivo like an app?',
    a: 'Yes. In Chrome or Edge, use the Install button in the suggestion card on Discover (or your browser menu → Install app). On iPhone or iPad, open Kontivo in Safari, tap Share, then “Add to Home Screen”.',
  },
  {
    q: 'Does Kontivo work offline?',
    a: 'The app itself does: once you have visited, the landing pages open instantly and still open without a connection, so an installed app never shows a blank screen. Sessions do not — they run live between browsers, so joining and sharing need a network. If you open a session link while offline you get an honest offline page instead of a broken room.',
  },
  {
    q: 'How does Folder Share rebuild my folder?',
    a: 'Files keep their relative paths inside the session. When everything is delivered, “Download all” bundles them into a ZIP with the same structure; unzip it and the folder is back. You can also save files one by one.',
  },
  {
    q: 'Is a call here private?',
    a: 'Yes. Video and audio travel directly between the devices in the session (peer-to-peer). There is no server recording, no cloud, and when the call ends nothing is left anywhere. Only people with the code can ever join.',
  },
  {
    q: 'What can my phone do here?',
    a: 'Quite a lot: it can be a wireless webcam or microphone for your computer, a presentation remote for the slides on your screen, a second glance at your monitor, a walkie-talkie, or a live camera. Open the tool, scan the code with the phone, and it takes the right role automatically.',
  },
  {
    q: 'Who is the “presenter” or “teacher” in a room?',
    a: 'Whoever started the session. In Webinar Room and Classroom, everyone else joins muted-by-design: they can chat, react and raise their hand, and the host spotlights people. That is why the presenter chip appears only for the session starter.',
  },
]

export function HelpView() {
  const navigate = usePlatform((s) => s.navigate)
  const [openItems, setOpenItems] = useState<string[]>(['faq-0'])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Help Center</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Human answers, no jargon. If something does not work the way this page says, that is a
        bug: the page should always win.
      </p>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Fix a problem</h2>
      <ul className="mt-4 divide-y border-y">
        {TROUBLESHOOTING.map((item) => (
          <li key={item.title} className="py-5">
            <h3 className="font-semibold leading-tight">{item.title}</h3>
            <ul className="mt-2.5 space-y-1.5">
              {item.steps.map((step) => (
                <li key={step} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Frequently asked</h2>
      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={setOpenItems}
        className="mt-4 border-t"
      >
        {FAQ.map((item, i) => (
          <AccordionItem key={item.q} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <p className="max-w-md text-sm text-muted-foreground">
          Sessions are protected by their code and by time. They end on their own. End a
          session yourself any time from its toolbar.
        </p>
        <div className="flex items-center gap-4 text-sm">
          <button
            className="font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => navigate({ name: 'sessions' })}
          >
            My Sessions
          </button>
          <button
            className="font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => navigate({ name: 'home' })}
          >
            Discover
          </button>
        </div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Still stuck? Try rejoining from My Sessions. A fresh join restores the full session state.
      </p>
    </div>
  )
}
