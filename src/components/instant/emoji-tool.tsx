'use client'

// Emoji Finder — search a built-in emoji set by name and keywords, grouped
// by category, click to copy. The dataset is embedded on this page (name +
// search keywords per entry): it covers the emoji people actually search
// for day to day rather than the full Unicode 16 catalog, and the count is
// stated honestly. No network API, nothing submitted.

import { useMemo, useRef, useState } from 'react'
import { Check, Copy, Search, Smile } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { PrivacyStrip } from '@/components/instant/instant-kit'
import { cn } from '@/lib/utils'

interface EmojiEntry {
  ch: string
  name: string
  kw: string[]
}

interface Category {
  id: string
  label: string
  items: EmojiEntry[]
}

// Compact line format: emoji|name|kw1 kw2 kw3 …
// A module-level set drops duplicate emoji characters across categories —
// the first entry (the better-named one) wins.
const SEEN_EMOJI = new Set<string>()

function parse(block: string): EmojiEntry[] {
  return block
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [ch, name, kw = ''] = line.split('|')
      return { ch, name, kw: kw ? kw.split(' ').filter(Boolean) : [] }
    })
    .filter((e) => {
      if (!e.ch || SEEN_EMOJI.has(e.ch)) return false
      SEEN_EMOJI.add(e.ch)
      return true
    })
}

const SMILEYS = parse(`
😀|grinning face|happy smile joy grin
😃|smiley face|happy smile open mouth
😄|smiling eyes grin|happy laugh smile
😁|beaming face|grin teeth smile
😆|squinting laugh|lol haha laugh
😅|laughing sweat|relief nervous laugh
🤣|rofl rolling on floor laughing|lol hilarious
😂|face with tears of joy|laugh cry lol crying happiness
🙂|slight smile|polite smile calm
🙃|upside down face|silly sarcastic
😉|wink|flirt joke
😊|smiling blush|warm shy happy
😇|smiling halo|angel innocent good
🥰|hearts face|love adore crush
😍|heart eyes|love crush admire
🤩|star struck|amazed wow excited celebrity
😘|kiss|love flirt kissy
😗|kissing face|kiss
😚|kissing closed eyes|kiss
😋|savoring food|yum delicious tasty
😛|tongue out|playful silly
😜|winking tongue|playful joke crazy
🤪|zany|crazy wild goofy
😝|squinting tongue|playful gross yuck
🤑|money mouth|rich profit dollar greedy
🤗|hug|embrace thanks warm
🤭|hand over mouth|oops giggle secret
🤫|shushing|quiet secret shh
🤔|thinking|hmm consider ponder
🤐|zipper mouth|silence secret
🤨|raised eyebrow|suspicious doubt skeptical
😐|neutral face|meh flat expressionless
😑|expressionless|blank meh
😶|no mouth|speechless silent
😏|smirk|smug sly flirt
😒|unamused|annoyed bored meh
🙄|eye roll|annoyed sarcasm whatever
😬|grimace|awkward yikes oops
🤥|lying pinocchio|lie nose deceive
😌|relieved|calm relieved content
😔|pensive|sad down disappointed
😪|sleepy|tired sleep drowsy
🤤|drooling|desire hungry sleepy
😴|sleeping|sleep zzz asleep
😷|mask|sick covid illness
🤒|thermometer face|sick fever ill
🤕|bandage head|injured hurt hurt
🤢|nauseated|sick gross vomiting
🤮|vomiting|sick gross puke
🤧|sneezing|sick allergy
🥵|hot face|heat sweating summer hot
🥶|cold face|freeze winter cold shivering
🥴|woozy|dizzy drunk confused tipsy
😵|knocked out|dead dizzy faint
🤯|mind blown|shocked explosion wow
🤠|cowboy|hat western sheriff
🥳|parting party|celebrate birthday party
🥸|disguise|incognito spy glasses
😎|cool sunglasses|cool chill sunglasses
🤓|nerd|geek smart glasses
🧐|monocle|inspect fancy detective
😕|confused|puzzle unsure
😟|worried|concern sad
🙁|frown|sad unhappy
☹️|frowning|sad upset
😮|open mouth|surprised wow oh
😯|hushed|surprised quiet
😲|astonished|shocked gasp
😳|flushed|embarrassed blush red
🥺|pleading puppy eyes|please beg sad
😦|frowning open mouth|worried shock
😧|anguished|distress shock
😨|fearful|scared afraid shock
😰|anxious sweat|nervous scared worry
😥|sad relieved|disappointed sweat
😢|crying tear|sad cry tears
😭|loudly crying|sob bawling sadness
😱|scream fear|horror shock scared
😖|confounded|frustrated upset
😣|persevering|struggle helpless
😞|disappointed|sad letdown
😓|downcast sweat|stressed tired work
😩|weary|exhausted tired fed up
😫|tired|exhausted exhausted whine
🥱|yawning|bored sleepy tired
😤|triumph steam|angry determined huff
😡|rage red|angry mad furious
😠|angry|mad upset cross
🤬|cursing symbols|swear angry rude
😈|smiling devil|evil mischief devil
👿|angry devil|imp evil angry
💀|skull|dead death skeleton
☠️|skull crossbones|danger poison death
💩|poop|funny rude crap
🤡|clown|circus creepy clown
👻|ghost|halloween spooky boo
👽|alien|ufo space extraterrestrial
🤖|robot|ai bot machine
🎃|jack-o-lantern|halloween pumpkin
😺|cat smile|cat happy kitty
😹|cat joy|cat laugh lol
😻|cat heart eyes|cat love
😼|cat smirk|cat smug
😽|cat kiss|cat kiss
🙀|cat shocked|cat scream oh no
😿|cat sad|cat cry
😾|cat pouting|cat grumpy angry
🙈|see-no-evil monkey|shy oops hide
🙉|hear-no-evil monkey|ignore
🙊|speak-no-evil monkey|secret quiet
💋|lipstick kiss|love kiss lips
💌|love letter|romance valentine
💘|heart arrow|cupid love
❤️|red heart|love like valentine
🩷|pink heart|love soft
🧡|orange heart|love
💛|yellow heart|love friendship
💚|green heart|love nature
💙|blue heart|love
💜|purple heart|love
🖤|black heart|dark love
🤍|white heart|pure love
🤎|brown heart|love
💔|broken heart|heartbreak sad divorce
❣️|heart exclamation|love
💕|two hearts|love couple
💞|revolving hearts|love spinning
💓|beating heart|love pulse
💗|growing heart|love
💖|sparkling heart|love sparkle
💘|heart with arrow|cupid valentine
💐|bouquet|flowers gift romance
🌸|cherry blossom|spring flower sakura
💐|flowers|bouquet bloom
🌹|rose|flower love romance
🌻|sunflower|flower yellow summer
🌷|tulip|flower spring
🌼|blossom daisy|flower
✨|sparkles|shine glitter magic magic
⭐|star|favorite gold rating
🌟|glowing star|shine special
💫|dizzy star|magic shoot
🔥|fire|hot lit flame trending
💥|collision|boom explosion burst
🎉|party popper|celebrate congrats birthday
🎊|confetti ball|celebrate party
🎈|balloon|party birthday
🎁|gift|present birthday christmas
`)

const PEOPLE = parse(`
👋|waving hand|hello goodbye hi
🤚|raised back hand|stop
✋|raised hand|stop high five
🖖|vulcan salute|spock star trek
👌|ok hand|perfect okay
🤌|pinched fingers|italian gesture what
✌️|victory hand|peace two win
🤞|crossed fingers|luck hope wish
🤟|love-you gesture|ily rock
🤘|sign of horns|rock metal
🤙|call me hand|shaka hang loose
👈|point left|direction
👉|point right|direction this
👆|point up|look there
👇|point down|below
☝️|index up|one point
✊|raised fist|power solidarity
👊|fist bump|punch bro
👏|clapping|applause bravo congratulations
🙌|raising hands|celebrate praise hooray
👐|open hands|give hug
🤲|palms up|pray offer
🤝|handshake|deal agreement meet
🙏|folded hands|please thanks pray namaste
✍️|writing hand|sign note author
💅|nail polish|mani self care sass
🤳|selfie|photo phone camera
💪|flexed bicep|strong muscle gym
🦾|mechanical arm|prosthetic robot
🧠|brain|smart mind idea
👀|eyes|look watch peek
👁️|eye|watch see
👄|mouth|lips
👅|tongue|taste lick
👣|footprints|steps walk baby
🫶|heart hands|love gesture
🤰|pregnant woman|baby expect
🤱|breast-feeding|baby nurse
👶|baby|infant child
🧒|child|kid
👦|boy|kid child
👧|girl|kid child
🧑|person|adult human
👨|man|adult male
👩|woman|adult female
🧓|older person|elder
👴|old man|grandpa elder
👵|old woman|grandma elder
👨‍💻|technologist|developer coder engineer
👩‍💻|woman technologist|coder developer
🧑‍🍳|cook|chef kitchen
🧑‍⚕️|health worker|doctor nurse
🧑‍🏫|teacher|school professor
🧑‍🔧|mechanic|repair fix
🧑‍🌾|farmer|farm agriculture
🧑‍🚀|astronaut|space nasa
🧑‍🎨|artist|paint draw
👮|police officer|cop law
🕵️|detective|sleuth spy investigate
💂|guard|soldier palace
🥷|ninja|stealth assassin
🧙|mage|wizard magic fantasy
🧚|fairy|magic pixie
🧛|vampire|dracula halloween
🧜‍♀️|mermaid|sea fantasy
🧟|zombie|undead halloween
💃|dancing woman|dance salsa party
🕺|dancing man|dance disco
👯|bunny ears dancers|friends party
🧘|person in lotus|yoga meditate zen
🚶|person walking|walk steps
🏃|person running|run jog exercise
🧗|climbing|climb mountain sport
🏋️|weightlifter|gym lift strength
🚴|cyclist|bike cycling
🤸|cartwheel|gymnastics flip
🤾|handball|sport
🏊|swimming|swim pool
🏄|surfing|surf wave
🚣|rower|boat row
🏇|horse racing|jockey derby
🧗‍♀️|woman climbing|climb
🤺|fencer|fencing sword
⛷️|skier|ski snow
🏂|snowboarder|snowboard snow
🏌️|golfer|golf sport swing flag
🤼|wrestlers|wrestling
🤽|water polo|sport pool
🙋|raising hand|question volunteer me
🙋‍♂️|man raising hand|question
💁|information desk|sassy help
🙅|no gesture|stop refuse deny
🙆|ok person|yes fine
🤦|face palm|doh mistake stupid
🤷|shrug|whatever dunno idk
💼|briefcase|work business office
🎓|graduation cap|graduate school university
🧢|billed cap|hat cap
👑|crown|king queen royal
🎩|top hat|fancy magic gentleman
🧣|scarf|winter warm
🧤|gloves|winter hands
🧦|socks|feet winter
👟|running shoe|sneaker sport shoe
🥾|hiking boot|boot outdoor
👠|high heel|shoe fashion
👡|sandal|shoe summer
👢|boot|shoe
👗|dress|fashion clothes
👘|kimono|japan robe
🥻|sari|india dress
🩱|one-piece swimsuit|swim beach
👙|bikini|swim beach
💄|lipstick|makeup beauty
`)

const ANIMALS = parse(`
🐶|dog face|dog puppy pet
🐱|cat face|cat kitten pet
🐭|mouse face|mouse rat
🐹|hamster|pet rodent
🐰|rabbit face|bunny easter pet
🦊|fox|clever animal
🐻|bear|animal
🐼|panda|animal china
🐻‍❄️|polar bear|animal arctic
🐨|koala|animal australia
🐯|tiger face|animal
🦁|lion|brave animal
🐮|cow face|animal milk
🐷|pig face|animal pork
🐸|frog|animal toad
🐵|monkey face|animal
🙈|see no evil|monkey shy
🙉|hear no evil|monkey
🙊|speak no evil|monkey secret
🐔|chicken|hen poultry
🐧|penguin|animal antarctica
🐦|bird|animal fly
🐤|baby chick|bird easter
🦆|duck|animal bird
🦅|eagle|bird usa
🦉|owl|bird night wise
🦇|bat|animal night halloween
🐺|wolf|animal
🐗|boar|pig animal
🐴|horse face|animal pony
🦄|unicorn|magic fantasy rainbow
🐝|honeybee|bee insect honey
🐛|bug caterpillar|insect larva
🦋|butterfly|insect pretty
🐌|snail|slow shell
🐞|lady beetle|ladybug insect luck
🐜|ant|insect
🕷️|spider|halloween web insect
🦂|scorpion|desert zodiac
🐢|turtle|slow animal shell
🐍|snake|animal serpent
🦎|lizard|reptile gecko
🦖|t-rex|dinosaur trex
🦕|sauropod|dinosaur
🐙|octopus|sea animal
🦑|squid|sea
🦐|shrimp|seafood prawn
🦞|lobster|seafood
🦀|crab|seafood beach
🐡|blowfish|sea fish
🐠|tropical fish|sea aquarium
🐟|fish|sea food
🐬|dolphin|sea smart
🐳|spouting whale|sea whale
🐋|whale|sea
🦈|shark|sea danger
🐊|crocodile|alligator reptile
🐅|tiger|animal stripes
🦓|zebra|animal stripes
🦍|gorilla|animal strong
🐘|elephant|animal big
🦒|giraffe|animal tall
🦔|hedgehog|animal spiky
🐇|rabbit|bunny
🦝|raccoon|animal trash panda
🦨|skunk|animal smell
🦡|badger|animal
🦫|beaver|animal dam
🦦|otter|animal cute
🦥|sloth|slow lazy
🐀|rat|mouse rodent
🐁|mouse|rodent
🐓|rooster|chicken morning bird
🦃|turkey|thanksgiving bird
🕊️|dove|peace bird
🦚|peacock|bird pretty
🦜|parrot|bird talk
🦢|swan|bird lake
🦩|flamingo|bird pink
🐇|bunny|rabbit
🐾|paw prints|animal track pet
🐉|dragon|chinese fantasy
🐲|dragon face|chinese fantasy
🌵|cactus|desert plant
🎄|christmas tree|holiday xmas
🌲|evergreen|tree forest
🌴|palm tree|beach tropical
🌱|seedling|plant grow eco
🌿|herb|plant leaf
☘️|shamrock|ireland luck clover
🍀|four leaf clover|luck lucky
🍁|maple leaf|autumn canada fall
🍂|fallen leaf|autumn fall
🍃|leaf wind|nature
🌍|globe europe-africa|earth world
🌎|globe americas|earth world
🌏|globe asia-australia|earth world
🌙|crescent moon|night sleep
🌚|new moon face|night dark
🌝|full moon face|night
🌟|glowing star|shine
🌞|sun with face|sunshine summer
☀️|sun|sunny weather hot
⛅|partly cloudy|weather
☁️|cloud|weather sky
🌈|rainbow|pride colorful weather
⚡|high voltage|lightning power zap fast
❄️|snowflake|winter cold snow
⛄|snowman|winter snow
🌊|water wave|sea ocean beach
💧|droplet|water drop
🔥|fire flame|hot lit
💨|dashes|wind fast run
🌪️|tornado|storm weather
🌫️|fog|weather mist
`)

const FOOD = parse(`
🍏|green apple|fruit
🍎|red apple|fruit
🍐|pear|fruit
🍊|tangerine|orange fruit
🍋|lemon|fruit sour
🍌|banana|fruit
🍉|watermelon|fruit summer
🍇|grapes|fruit wine
🍓|strawberry|fruit berry
🫐|blueberries|fruit berry
🍈|melon|fruit
🍒|cherries|fruit
🍑|peach|fruit butt
🥭|mango|tropical fruit
🍍|pineapple|tropical fruit
🥥|coconut|tropical
🥝|kiwi fruit|fruit
🍅|tomato|vegetable salad
🍆|eggplant|vegetable aubergine
🥑|avocado|toast healthy
🥦|broccoli|vegetable healthy
🥬|leafy greens|salad lettuce
🥒|cucumber|salad pickle
🌶️|hot pepper|spicy chili
🌽|corn|vegetable maze
🥕|carrot|vegetable orange
🧄|garlic|cooking
🧅|onion|cooking
🥔|potato|vegetable chips
🍠|roasted sweet potato|yam
🥐|croissant|bread french breakfast
🥯|bagel|bread breakfast
🍞|bread|loaf toast
🥖|baguette|bread french
🥨|pretzel|snack
🧀|cheese wedge|dairy
🥚|egg|breakfast protein
🍳|cooking fried egg|breakfast pan
🧇|waffle|breakfast breakfast
🥞|pancakes|breakfast stack
🥓|bacon|breakfast pork
🍗|poultry leg|chicken drumstick
🍖|meat on bone|bbq
🌭|hot dog|sausage street food
🍔|hamburger|burger fast food
🍟|french fries|fast food chips
🍕|pizza|slice fast food
🥙|stuffed flatbread|wrap kebab
🌮|taco|mexican food
🌯|burrito|mexican wrap
🥗|green salad|healthy bowl
🍝|spaghetti|pasta italian
🍜|steaming noodles|ramen soup
🍲|hot pot|stew soup
🍛|curry rice|indian food
🍣|sushi|japanese fish
🍱|bento box|japanese lunch
🍚|cooked rice|rice bowl
🍥|fish cake|narutomaki ramen
🥟|dumpling|gyoza momo
🍦|soft ice cream|dessert cone
🍧|shaved ice|dessert
🍨|ice cream|dessert sundae
🍩|doughnut|dessert sweet donut
🍪|cookie|dessert sweet biscuit
🎂|birthday cake|party celebrate
🍰|shortcake|dessert cake slice
🧁|cupcake|dessert sweet
🍫|chocolate bar|candy sweet
🍬|candy|sweet sugar
🍭|lollipop|candy sweet
🍯|honey pot|sweet bee
🍼|baby bottle|milk infant
🥛|glass of milk|dairy drink
☕|hot beverage|coffee tea morning
🍵|teacup|green tea matcha
🧋|bubble tea|boba milk tea
🥤|cup with straw|soda drink
🧃|juice box|drink juice
🍺|beer mug|drink pub cheers
🍻|clinking beers|cheers drink
🥂|clinking glasses|champagne celebrate
🍷|wine glass|red wine drink
🥃|tumbler|whiskey scotch
🍸|cocktail glass|martini bar drink
🍹|tropical drink|cocktail beach
🍾|bottle popping|champagne celebrate party
🧊|ice cube|cold freeze
🥄|spoon|cutlery
🍴|fork and knife|eat restaurant
🍽️|fork knife plate|dinner eat
🧂|salt|seasoning shaker
🫙|jar|container preserve
`)

const ACTIVITY = parse(`
⚽|soccer ball|football sport
🏀|basketball|sport hoop
🏈|american football|sport nfl
⚾|baseball|sport
🥎|softball|sport
🎾|tennis|sport racket
🏐|volleyball|sport
🏉|rugby|sport
🥏|flying disc|frisbee sport
🎱|pool 8 ball|billiards snooker
🏓|ping pong|table tennis
🏸|badminton|sport racket
🥊|boxing glove|fight sport
🥋|martial arts uniform|karate judo
⛳|flag in hole|golf sport
🎣|fishing pole|fish hobby
🤿|diving mask|snorkel scuba
🎿|skis|snow winter sport
🛹|skateboard|skate sport
🛼|roller skate|skating
⛸️|ice skate|winter sport
🥌|curling stone|sport
🏆|trophy|win champion first
🥇|gold medal|first win
🥈|silver medal|second
🥉|bronze medal|third
🏅|sports medal|award win
🎖️|military medal|honor award
🎯|direct hit|target bullseye dart
🪀|yo-yo|toy
🪁|kite|fly wind toy
🎮|video game|gaming controller game
🕹️|joystick|arcade retro game
🎲|game die|dice random board
♟️|chess pawn|chess strategy
🧩|puzzle piece|jigsaw solve
🎯|target|bullseye
🎳|bowling|sport pins
🎰|slot machine|casino gamble
🎴|flower playing cards|hanafuda game
♠️|spade suit|cards poker
♥️|heart suit|cards poker
♦️|diamond suit|cards poker
♣️|club suit|cards poker
🃏|joker|cards wild
🎪|circus tent|show carnival
🎭|performing arts|theater drama masks
🎨|artist palette|paint art design
🎬|clapper board|film movie action
🎤|microphone|sing karaoke podcast
🎧|headphone|music audio listen
🎼|musical score|sheet music notes
🎹|musical keyboard|piano music
🥁|drum|music beat
🎷|saxophone|music jazz
🎺|trumpet|music brass
🎸|guitar|music rock
🎻|violin|music classical
🎺|trumpet|brass
🎤|mic|sing
🎧|headphones|music
🎼|music notes|sheet
🎵|musical note|music song tune
🎶|musical notes|music melody
📻|radio|broadcast music
🎬|movie|film
🎫|ticket|admission event concert
🎟️|admission tickets|event entry
🎭|theater|drama
🪩|mirror ball|disco party dance
🎳|bowling|game
🚀|rocket|launch space startup fast
🛸|flying saucer|ufo alien
`)

const TRAVEL = parse(`
🚗|automobile|car drive vehicle
🚕|taxi|cab ride
🚙|sport utility vehicle|suv car
🚌|bus|transport public
🚎|trolleybus|bus transport
🏎️|racing car|f1 fast speed
🚓|police car|cop law
🚑|ambulance|emergency medical
🚒|fire engine|firetruck emergency
🚐|minibus|van
🛻|pickup truck|truck
🚚|delivery truck|lorry freight
🚛|articulated lorry|semi truck freight
🚜|tractor|farm agriculture
🛵|motor scooter|scooter delivery
🏍️|motorcycle|racing motorbike
🚲|bicycle|bike cycle
🛴|kick scooter|scooter
🚨|police light|emergency alert siren
🚔|oncoming police|police
🚇|metro|subway underground train
🚆|train|railway rail
🚄|high-speed train|bullet speed rail
🚅|bullet train|shinkansen fast rail
🚂|steam locomotive|train railway vintage
🚋|tram car|streetcar trolley
🚡|aerial tramway|cable car mountain
🚠|mountain cableway|gondola ski
🚟|suspension railway|monorail
🛶|canoe|boat paddle
🚤|speedboat|boat fast
🛳️|passenger ship|cruise
⛴️|ferry|boat crossing
🚢|ship|ocean boat
⚓|anchor|ship harbor nautical
🪝|hook|fish catch grab
⛽|fuel pump|gas petrol station
🚧|construction|under construction barrier roadwork
🗺️|world map|travel map navigation
🧭|compass|navigation direction
🗼|tokyo tower|japan landmark
🗽|statue of liberty|new york landmark usa
🏰|castle|fairytale medieval
🏯|japanese castle|japan landmark
🏟️|stadium|sports concert venue
🎡|ferris wheel|amusement park fair
🎢|roller coaster|amusement park thrill
🎠|carousel horse|amusement merry-go-round
⛲|fountain|park water
⛱️|umbrella on ground|beach vacation
🏖️|beach umbrella|vacation sand tropical
🏝️|desert island|tropical vacation
🏜️|desert|dry sand landscape
🌋|volcano|eruption lava mountain
⛰️|mountain|climb peak
🏔️|snow-capped mountain|peak alps
🗻|mount fuji|japan landmark
🏕️|camping|tent outdoors
⛺|tent|camping outdoors
🏠|house|home building
🏡|house with garden|home
🏘️|houses|neighborhood
🏚️|derelict house|abandoned
🏗️|building construction|crane site
🏭|factory|industrial plant
🏢|office building|work corporate
🏬|department store|shop mall
🏪|convenience store|shop 24/7
🏫|school|education learn
🏥|hospital|medical health
🏦|bank|money finance
🏨|hotel|stay lodging
⛪|church|christian worship
🕌|mosque|islam worship
🛕|hindu temple|worship india
🕍|synagogue|jewish worship
⛩️|shinto shrine|japan torii
🕋|kaaba|mecca islam
🗽|liberty|usa
⛲|fountain|water
🌃|night stars|city night skyline
🌆|cityscape dusk|city evening
🏙️|cityscape|skyline urban
🌄|sunrise mountains|morning view
🌅|sunrise|morning beach view
🌇|sunset|evening city
🌏|earth|world planet
🌐|globe with meridians|internet world web
🌑|new moon|dark night
🌓|first quarter moon|phase
🌕|full moon|night bright
🌙|crescent|night sleep
⭐|star|night
✨|sparkles|magic
💫|shooting star|wish
🌠|shooting star sky|wish
☄️|comet|space sky
🛰️|satellite|space orbit gps
🚀|rocket|launch
🪐|ringed planet|saturn space
🌌|milky way|galaxy space stars
🌠|star night|sky
🌙|moon|night
🌈|rainbow|color pride
☔|umbrella rain|rain wet
☂️|umbrella|rain
🌂|closed umbrella|rain
💧|drop|water
🌊|wave|ocean sea
`)

const OBJECTS = parse(`
⌚|watch|time wristwatch
📱|mobile phone|smartphone cell
📲|phone with arrow|call incoming
💻|laptop|computer work notebook
🖥️|desktop computer|monitor pc
⌨️|keyboard|typing computer
🖱️|computer mouse|click
🖨️|printer|print paper
💾|floppy disk|save retro
💿|optical disc|cd disc
📀|dvd|disc movie
📷|camera|photo picture
📸|flash camera|photo snap
📹|video camera|record
📼|videocassette|vhs retro tape
🔍|magnifying glass|search zoom find
🔎|right magnifier|search
🕯️|candle|light relax
💡|light bulb|idea innovation
🔦|flashlight|torch light
🏮|red paper lantern|japan festival
📔|notebook decorative|journal
📕|closed book|read
📖|open book|read study novel
📗|green book|read
📚|books|library study read
📓|notebook|write notes
📃|page with curl|document
📜|scroll|document history
📰|newspaper|news press
🗞️|rolled newspaper|news
📄|page facing up|document file
📑|bookmark tabs|files organize
🔖|bookmark|save read
🏷️|label|tag price
💰|money bag|cash wealth
🪙|coin|money gold
💴|yen banknote|money japan
💵|dollar banknote|money cash usd
💶|euro banknote|money eur
💷|pound banknote|money gbp
💳|credit card|pay bank
🧾|receipt|bill invoice checkout
✉️|envelope|mail letter email
📩|envelope arrow|email sent
📨|incoming envelope|email received
📧|e-mail|email
💌|love letter|romance
📤|outbox|send
📥|inbox|receive
📦|package|parcel box delivery shipping
📫|closed mailbox|mail post
🗳️|ballot box|vote election
✏️|pencil|write draw edit
✒️|fountain pen|write sign
🖊️|pen|write
🖋️|fountain pen|write
🖌️|paintbrush|art paint
🖍️|crayon|color draw
📝|memo|note write list
📁|folder|file organize
📂|open folder|files
🗂️|card index dividers|organize files
📅|calendar|date schedule
🗓️|spiral calendar|schedule date
📆|tear-off calendar|date
📇|card index|contacts
📈|chart increasing|growth up stocks
📉|chart decreasing|down loss stocks
📊|bar chart|stats data
📋|clipboard|list checklist
📌|pushpin|pin note location
📍|round pushpin|location pin place
📎|paperclip|attach clip
🖇️|paperclips|attach
📏|straight ruler|measure
📐|triangular ruler|measure math
✂️|scissors|cut
🗃️|card file box|archive
🗄️|file cabinet|archive office
🗑️|wastebasket|trash delete bin
🔒|locked|secure private password
🔓|unlocked|open
🔏|locked pen|secure private
🔐|locked key|secure private password
🔑|key|access unlock password
🗝️|old key|vintage access
🔨|hammer|tool build fix
🪓|axe|chop tool
🪚|carpentry saw|cut wood
🔧|wrench|tool fix repair
🪛|screwdriver|tool fix
🩹|adhesive bandage|band-aid hurt
🩺|stethoscope|doctor health
💊|pill|medicine drug health
💉|syringe|shot vaccine medical
🩸|drop of blood|blood medical
🚪|door|enter exit
🛏️|bed|sleep hotel
🛋️|couch|sofa lounge
🪑|chair|seat
🚽|toilet|bathroom wc
🚿|shower|bath wash
🛁|bathtub|bath relax
🧴|lotion|cream sunscreen
🧹|broom|clean sweep
🧺|basket|laundry picnic
🧻|roll of paper|toilet paper tissue
🧼|soap|wash clean hygiene
🪥|toothbrush|teeth clean
🧽|sponge|clean wash
🪣|bucket|clean water
🛒|shopping cart|buy store checkout
🛍️|shopping bags|shopping buy
🎁|present|gift birthday
🎈|balloon|party
🎀|ribbon|gift bow decoration
🪄|magic wand|magic spell
🪤|trap|mousetrap
🧲|magnet|attract science
🧪|test tube|science chemistry experiment
🧫|petri dish|biology science
🧬|dna|genetics science biology
🔬|microscope|science biology research
🔭|telescope|space stars astronomy
📡|satellite antenna|signal dish
💉|syringe|vaccine
🩻|x-ray|bone medical
🚦|vertical traffic light|signal stop go
🛑|stop sign|halt octagon
🚏|bus stop|transport
🗺️|map|travel
🗿|moai|easter island statue
🛟|ring buoy|life saver rescue safety
🔔|bell|notification alert ring
🔕|bell crossed|mute silent notification
📢|loudspeaker|announce announcement
📣|megaphone|cheer announce
🔊|speaker loud|volume sound
🔉|speaker medium|volume
🔈|speaker low|volume quiet
🔇|muted speaker|silence volume off
⏰|alarm clock|wake morning time
⏱️|stopwatch|timer speed
⏲️|timer clock|countdown
🕰️|mantelpiece clock|antique time
⏳|hourglass|time sand wait
⌛|hourglass done|time wait
📶|antenna bars|signal network strength
🔋|battery|power charge full
🪫|low battery|power empty charge
🔌|electric plug|power charge outlet
💡|bulb|idea
`)

const SYMBOLS = parse(`
❤️|red heart|love
🧡|orange heart|love
💛|yellow heart|love
💚|green heart|love
💙|blue heart|love
💜|purple heart|love
🖤|black heart|love dark
🤍|white heart|love pure
💯|hundred points|perfect score 100 keep
💢|anger symbol|frustration comic
💥|collision|boom
💤|zzz|sleep
💫|dizzy|stars
💬|speech balloon|chat comment message talk
💭|thought balloon|think idea
🗯️|right anger bubble|angry speech
✅|check mark|done complete yes
☑️|check box|done selected
✔️|check|yes done
❌|cross mark|wrong no fail
❎|cross button|no deny
➕|plus|add math
➖|minus|subtract math
➗|divide|math division
✖️|multiply|math times
🟰|equals|math equal
♾️|infinity|forever endless
❓|question mark|ask help confused
❔|white question|ask
❗|exclamation|important alert warning
❕|white exclamation|notice
❣️|heart exclamation|love emphasis
‼️|double exclamation|urgent important
⁉️|exclamation question|confused surprise
💤|sleep|zzz
♻️|recycling|green environment eco
✳️|eight-spoked asterisk|star note
✴️|eight-pointed star|star
❇️|sparkle|glitter
⚠️|warning|caution danger alert
🚸|children crossing|school zone
🔞|18 restricted|adult no minors
🚫|prohibited|no ban forbidden
⛔|no entry|stop forbidden
🛑|stop|halt
🆗|ok button|okay
🆕|new|fresh new
🆓|free|no charge
🆒|cool|cool
🆘|sos|help emergency
🆚|vs|versus compare
Ⓜ️|circled m|metro brand
🏧|atm sign|bank money cash
🚾|wc|toilet restroom
♿|wheelchair|accessible accessibility
🚹|mens|restroom
🚺|womens|restroom
🅿️|parking|car park
🈯|japanese free|vacancy
🔟|keycap ten|10
🔢|numbers|1234 count
#️⃣|keycap hash|hashtag number
*️⃣|keycap asterisk|star
0️⃣|keycap zero|0
1️⃣|keycap one|1
2️⃣|keycap two|2
3️⃣|keycap three|3
4️⃣|keycap four|4
5️⃣|keycap five|5
6️⃣|keycap six|6
7️⃣|keycap seven|7
8️⃣|keycap eight|8
9️⃣|keycap nine|9
🔔|bell|notification
🎵|musical note|music song
🎵|note|music
🅰️|a button|blood type
🆎|ab button|blood type
🅱️|b button|blood type
🈴|japanese pass|grade
🉐|japanese bargain|deal
🕐|one oclock|time clock
🕒|three oclock|time
🕐|clock|time
🔈|speaker|volume
☑️|checkbox|yes
`);

const FLAGS = parse(`
🏁|chequered flag|race finish start
🚩|triangular flag|mark red flag alert
🎌|crossed flags|japan celebration
🏴|black flag|pirate
🏳️|white flag|surrender peace
🏳️‍🌈|rainbow flag|pride lgbtq
🇺🇸|united states|usa america flag
🇬🇧|united kingdom|uk britain flag
🇨🇦|canada|flag
🇦🇺|australia|flag
🇮🇳|india|flag indian
🇩🇪|germany|flag
🇫🇷|france|flag
🇪🇸|spain|flag
🇮🇹|italy|flag
🇯🇵|japan|flag
🇰🇷|south korea|flag korea
🇨🇳|china|flag chinese
🇧🇷|brazil|flag
🇲🇽|mexico|flag
🇦🇪|united arab emirates|uae dubai flag
🇸🇦|saudi arabia|flag
🇸🇬|singapore|flag
🇳🇿|new zealand|flag
🇮🇪|ireland|flag
🇳🇱|netherlands|flag
🇵🇭|philippines|flag
🇵🇰|pakistan|flag
🇧🇩|bangladesh|flag
🇿🇦|south africa|flag
🇳🇬|nigeria|flag
🇰🇪|kenya|flag
🇪🇬|egypt|flag
🇹🇷|turkey|flag
🇷🇺|russia|flag
🇺🇦|ukraine|flag
🇵🇱|poland|flag
🇸🇪|sweden|flag
🇳🇴|norway|flag
🇩🇰|denmark|flag
🇫🇮|finland|flag
🇨🇭|switzerland|flag
🇦🇹|austria|flag
🇧🇪|belgium|flag
🇵🇹|portugal|flag
🇬🇷|greece|flag
🇦🇷|argentina|flag
🇨🇱|chile|flag
🇨🇴|colombia|flag
🇮🇩|indonesia|flag
🇲🇾|malaysia|flag
🇹🇭|thailand|flag
🇻🇳|vietnam|flag
🇪🇺|european union|eu flag
`)

const CATEGORIES: Category[] = [
  { id: 'smileys', label: 'Smileys & hearts', items: SMILEYS },
  { id: 'people', label: 'People & gestures', items: PEOPLE },
  { id: 'animals', label: 'Animals & nature', items: ANIMALS },
  { id: 'food', label: 'Food & drink', items: FOOD },
  { id: 'activity', label: 'Activity & music', items: ACTIVITY },
  { id: 'travel', label: 'Travel & places', items: TRAVEL },
  { id: 'objects', label: 'Objects', items: OBJECTS },
  { id: 'symbols', label: 'Symbols', items: SYMBOLS },
  { id: 'flags', label: 'Flags', items: FLAGS },
]

const TOTAL = CATEGORIES.reduce((a, c) => a + c.items.length, 0)

export function EmojiTool() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [copied, setCopied] = useState<string | null>(null)
  const [recents, setRecents] = useState<string[]>([])
  const copiedTimer = useRef<number | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CATEGORIES
      .filter((c) => category === 'all' || c.id === category)
      .map((c) => ({
        ...c,
        items: q
          ? c.items.filter(
              (e) =>
                e.name.toLowerCase().includes(q) ||
                e.kw.some((k) => k.includes(q)) ||
                e.ch === q,
            )
          : c.items,
      }))
      .filter((c) => c.items.length > 0)
  }, [query, category])

  const copy = async (entry: EmojiEntry) => {
    try {
      await navigator.clipboard.writeText(entry.ch)
      setCopied(entry.ch)
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopied(null), 1500)
      setRecents((r) => [entry.ch, ...r.filter((c) => c !== entry.ch)].slice(0, 12))
    } catch {
      /* clipboard denied — the emoji grid stays clickable for manual selection */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <Label htmlFor="emoji-search" className="flex items-center gap-2 text-sm font-semibold">
          <Search className="size-4 text-primary" aria-hidden="true" />
          Search {TOTAL.toLocaleString()} emojis by name or keyword
        </Label>
        <input
          id="emoji-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. “heart”, “fire”, “dog”, “pizza”, “sad”…"
          className="mt-2 h-11 w-full rounded-md border bg-background px-3.5 text-base"
        />
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Emoji category">
          <button
            type="button"
            onClick={() => setCategory('all')}
            aria-pressed={category === 'all'}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              category === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted',
            )}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                category === c.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {recents.length > 0 && query === '' && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Recently copied</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recents.map((ch) => (
              <span key={ch} className="rounded-lg border bg-background px-2.5 py-1.5 text-2xl leading-none">
                {ch}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">This row lives in this tab only — closing the page clears it.</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground" role="status">
          Nothing in the built-in set matches “{query}”. The set covers the everyday emojis by their common names — it is not the full Unicode catalog.
        </p>
      ) : (
        filtered.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">
              {c.label} <span className="font-normal text-muted-foreground">· {c.items.length}</span>
            </h2>
            <div className="mt-2 grid grid-cols-6 gap-1 sm:grid-cols-10 lg:grid-cols-12">
              {c.items.map((e) => (
                <button
                  key={`${e.ch}-${e.name}`}
                  type="button"
                  title={`${e.name} — click to copy`}
                  aria-label={`${e.name} — click to copy`}
                  onClick={() => void copy(e)}
                  className="group flex flex-col items-center rounded-lg p-1.5 transition-colors hover:bg-muted"
                >
                  <span className="text-2xl leading-none">{e.ch}</span>
                  <span className="mt-1 flex items-center text-[9px] leading-tight text-muted-foreground">
                    {copied === e.ch ? (
                      <>
                        <Check className="size-2.5" aria-hidden="true" /> copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-2.5 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden="true" />
                        <span className="max-w-full truncate px-0.5">{e.kw[0] ?? e.name.split(' ')[0]}</span>
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      <PrivacyStrip detail="The emoji table is embedded on this page — search runs against it locally, clicks copy to your clipboard, and the recents row is tab memory only. Nothing is searched online or stored." />
    </div>
  )
}
