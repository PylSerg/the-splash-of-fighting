import type { FighterId } from '../combat/Fighter';

/**
 * Procedural full-body SVGs for the character carousel.
 * A SINGLE vector model per fighter is transformed and dimmed by CSS.
 * No duplicated preview images are needed for the left/right carousel slots.
 *
 * When real sprites arrive, replace this renderer without changing carousel
 * navigation, roster rules or the fight engine.
 */
export function characterFigureSvg(id: FighterId): string {
  if (id === 'kai') {
    // Dedicated electric fighter silhouette, no extra image files or duplicate
    // rendered variants required by the selection carousel.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 500"
      role="img" aria-label="Повноростова фігура Кая">
      <defs>
        <linearGradient id="kai-jacket" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#315771"/><stop offset=".57" stop-color="#203853"/>
          <stop offset="1" stop-color="#132941"/>
        </linearGradient>
        <linearGradient id="kai-silver" x1="0" y1="0" x2=".8" y2="1">
          <stop stop-color="#f7ffff"/><stop offset=".58" stop-color="#d1e3f7"/>
          <stop offset="1" stop-color="#91afd6"/>
        </linearGradient>
        <linearGradient id="kai-energy" x1="0" y1="0" x2="1" y2="0">
          <stop stop-color="#6bb4ff"/><stop offset=".5" stop-color="#d9ffff"/>
          <stop offset="1" stop-color="#5ce9f1"/>
        </linearGradient>
      </defs>
      <g stroke-linecap="round" stroke-linejoin="round">
        <!-- Flowing split scarf and electric-blue coat tails. -->
        <path d="M125 174Q77 222 46 396L110 371 146 265
          Q207 317 256 402L217 256 181 173Z"
          fill="#284871" stroke="#6cd4ec" stroke-width="5"/>
        <path d="M120 180Q91 256 72 361M181 181Q225 270 238 352"
          fill="none" stroke="#77ddfc" stroke-width="4" opacity=".75"/>
        <path d="M93 295L60 350 86 338 73 390"
          fill="none" stroke="#9deef6" stroke-width="4" opacity=".8"/>
        <!-- Long boots and separately posed legs. -->
        <path d="M120 283L154 285L146 380L141 474L100 475L108 382Z"
          fill="#20364b" stroke="#10243e" stroke-width="6"/>
        <path d="M163 283L195 279L203 388L212 470L172 475L161 388Z"
          fill="#26465e" stroke="#10243e" stroke-width="6"/>
        <path d="M107 424L146 425L139 476Q125 490 94 478Z"
          fill="#174762" stroke="#74eaf3" stroke-width="5"/>
        <path d="M170 425L205 425L220 473Q211 489 173 477Z"
          fill="#174762" stroke="#74eaf3" stroke-width="5"/>
        <path d="M105 444L140 444M174 446L211 446"
          stroke="#a9faff" stroke-width="5"/>
        <path d="M115 348L147 348M168 349L198 349"
          stroke="#618ba9" stroke-width="4"/>
        <!-- Rear arm with navy sleeve. -->
        <path d="M116 176Q93 181 86 200L61 266
          Q59 281 72 286Q85 283 90 267L117 217Z"
          fill="#d4ac96" stroke="#8c6d78" stroke-width="5"/>
        <path d="M112 179L95 181L78 237L101 245L130 202Z"
          fill="url(#kai-jacket)" stroke="#64d9eb" stroke-width="5"/>
        <path d="M88 227L99 238" stroke="#bafaff" stroke-width="4"/>
        <!-- Jacket torso with asymmetric electric insignia. -->
        <path d="M116 168L141 160L178 162L200 182L194 290
          Q159 306 105 283L102 193Z"
          fill="url(#kai-jacket)" stroke="#0e263d" stroke-width="7"/>
        <path d="M137 167L155 206L174 167L183 275L129 275Z"
          fill="#355a76" stroke="#88dae9" stroke-width="4"/>
        <path d="M154 200L141 228L157 222L144 257L174 215L158 219L168 202Z"
          fill="url(#kai-energy)" stroke="#e0ffff" stroke-width="2"/>
        <path d="M113 275L194 274" stroke="#72d9ed" stroke-width="9"/>
        <path d="M117 290L182 293" stroke="#132c42" stroke-width="7"/>
        <!-- Neck and pale complexion. -->
        <path d="M136 148L138 177Q154 193 170 176L170 146Z"
          fill="#d4ac96" stroke="#9a7984" stroke-width="5"/>
        <!-- Short tousled silver hair, separated into angular strands. -->
        <path d="M103 102Q83 64 116 37Q142 16 169 33
          Q199 20 210 59L197 111L112 137Z"
          fill="url(#kai-silver)" stroke="#799ab7" stroke-width="5"/>
        <path d="M113 60L84 32 115 38 128 14 146 39 178 18
          184 40 209 25 196 65Z"
          fill="url(#kai-silver)" stroke="#83a6c4" stroke-width="4"/>
        <path d="M110 90Q116 70 153 60Q176 57 196 83L188 140
          Q179 170 152 174Q127 169 115 141Z"
          fill="#d8b09a" stroke="#a37e80" stroke-width="5"/>
        <path d="M111 94Q122 70 143 76L161 67 199 81
          Q191 105 164 102L148 88Q129 104 111 108Z"
          fill="url(#kai-silver)"/>
        <path d="M119 116L144 114M162 115L184 112"
          stroke="#34506a" stroke-width="5"/>
        <ellipse cx="138" cy="125" rx="5" ry="6" fill="#54e9f2"/>
        <ellipse cx="177" cy="124" rx="5" ry="6" fill="#54e9f2"/>
        <path d="M146 138L154 141L161 138"
          fill="none" stroke="#9c737d" stroke-width="3"/>
        <path d="M141 150Q155 156 170 149"
          fill="none" stroke="#906b73" stroke-width="4"/>
        <path d="M122 110Q130 102 141 103"
          stroke="#6d9bb1" stroke-width="3" opacity=".7"/>
        <!-- Forward arm and electrified double batons. -->
        <path d="M189 181Q210 176 218 197L246 251
          Q249 268 234 279Q219 281 212 262L183 211Z"
          fill="#d4ac96" stroke="#9c7780" stroke-width="5"/>
        <path d="M184 183L200 178L229 225L211 240L181 207Z"
          fill="url(#kai-jacket)" stroke="#78d9ed" stroke-width="5"/>
        <path d="M217 251L236 250L244 265Q238 282 226 282
          Q212 274 217 251Z" fill="#d4ac96" stroke="#9c7780" stroke-width="4"/>
        <g transform="translate(231 258) rotate(-29)">
          <path d="M-7 5L95 -47" stroke="#1f385a" stroke-width="18"/>
          <path d="M15 -6L99 -50" stroke="url(#kai-energy)" stroke-width="11"/>
          <path d="M39 -20L96 -49" stroke="#e7ffff" stroke-width="3"/>
          <path d="M18 -12L-1 -36" stroke="#648dff" stroke-width="10"/>
          <path d="M87 -58L103 -69 92 -48 113 -44"
            fill="none" stroke="#94f9fb" stroke-width="4" opacity=".87"/>
        </g>
        <g transform="translate(65 273) rotate(29)">
          <path d="M0 0L-39 -67" stroke="#1f385a" stroke-width="14"/>
          <path d="M-5 -8L-36 -64" stroke="#8ef6fa" stroke-width="7"/>
          <path d="M-32 -66L-41 -79 -33 -59" stroke="#d5ffff" stroke-width="3"/>
        </g>
      </g>
    </svg>`;
  }
  const palette = {
    evi: {
      skin: '#eac6a8', shadow: '#bb887a', main: '#fff4e9', panel: '#f6dbe4',
      trim: '#d7ac78', dark: '#5c506f', hair: '#f3cb92', hairLight: '#ffe6b4',
      cape: '#d9d0ef', accent: '#e698c1', boot: '#f6f1e4',
    },
    nara: {
      skin: '#cfa4a4', shadow: '#956d83', main: '#302a42', panel: '#67516b',
      trim: '#a6ef90', dark: '#191c36', hair: '#48cbd4', hairLight: '#9ef9e9',
      cape: '#23b7c9', accent: '#a6e786', boot: '#24253e',
    },
    lyra: {
      skin: '#edb99b', shadow: '#b87f75', main: '#263b5c', panel: '#526e91',
      trim: '#ffc26d', dark: '#192941', hair: '#e87656', hairLight: '#ffd28d',
      cape: '#f1a05d', accent: '#f6bd6c', boot: '#a86e4c',
    },
  }[id];
  const hair = id === 'evi'
    ? `<path d="M100 112Q86 54 121 35Q156 18 188 45Q210 74 196 143L176 154L117 157Z"
          fill="url(#hair-${id})" stroke="#bd8d7f" stroke-width="4"/>
       <path d="M108 95Q113 45 153 43Q190 43 197 97Q184 79 175 77Q152 80 137 100Z"
          fill="${palette.hairLight}"/>
       <path d="M105 112Q92 133 103 180L118 170L118 104Z" fill="${palette.hair}"/>
       <path d="M194 102Q207 141 191 174L179 169L182 103Z" fill="${palette.hair}"/>`
    : id === 'nara'
    ? `<path d="M114 112Q85 82 98 50Q111 19 153 27Q172 13 196 38Q216 57 207 94Q234 82 244 104Q253 133 220 147L191 129L116 152Z"
          fill="url(#hair-${id})" stroke="#23667f" stroke-width="4"/>
       <path d="M102 77Q89 41 125 25Q161 8 182 26Q209 23 211 59Q226 72 211 94Q191 67 161 70Q135 79 102 77"
          fill="${palette.hairLight}"/>
       <path d="M199 86Q238 80 246 113Q242 139 210 132L188 109Z" fill="${palette.hair}"/>`
    : `<path d="M101 112Q82 50 126 31Q161 9 191 41Q210 68 198 117L186 155L112 152Z"
          fill="url(#hair-${id})" stroke="#ad5a59" stroke-width="4"/>
       <path d="M192 57Q225 34 250 68Q267 91 257 133L244 106Q232 130 212 131L188 90Z"
          fill="${palette.hair}"/>
       <path d="M116 71Q146 38 187 66Q173 80 139 91L106 102Z"
          fill="${palette.hairLight}"/>`;

  const details = id === 'evi'
    ? `<path d="M120 171L145 189L163 169L187 181L196 279L101 280L108 183Z"
          fill="${palette.main}" stroke="${palette.trim}" stroke-width="5"/>
       <path d="M134 184L151 210L166 184L165 276L136 277Z" fill="${palette.panel}"/>
       <path d="M112 272L193 270L185 292L119 291Z" fill="${palette.trim}"/>
       <path d="M125 209L177 210" stroke="#ffffff" stroke-width="5" opacity=".75"/>`
    : id === 'nara'
    ? `<path d="M117 170L149 190L176 170L199 186L195 290L105 290L104 188Z"
          fill="${palette.main}" stroke="#9671a0" stroke-width="6"/>
       <path d="M136 194L168 194L181 254L117 255Z" fill="${palette.panel}"/>
       <circle cx="153" cy="228" r="15" fill="#a4ef80" stroke="#61716f" stroke-width="5"/>
       <path d="M115 271L188 271" stroke="${palette.trim}" stroke-width="9"/>`
    : `<path d="M119 169L149 182L178 169L199 190L194 290L106 290L103 190Z"
          fill="${palette.main}" stroke="${palette.trim}" stroke-width="6"/>
       <path d="M150 183L169 205L150 255L128 205Z" fill="${palette.panel}"/>
       <path d="M113 219L185 219" stroke="${palette.trim}" stroke-width="7"/>
       <circle cx="151" cy="241" r="13" fill="#f4b465" stroke="#ffe3b1" stroke-width="4"/>
       <path d="M118 271L185 271" stroke="#f1bf78" stroke-width="8"/>`;

  const weapon = id === 'evi'
    ? `<g transform="translate(220 216) rotate(-17)">
        <path d="M0 0L55 -68Q87 -64 89 -27L10 11Z" fill="#fcf3de" stroke="#d8b3af" stroke-width="5"/>
        <path d="M4 1L55 -69M8 5L74 -57M11 6L85 -34" stroke="#cba5ba" stroke-width="3"/>
        <path d="M-5 7L24 -9" stroke="#8a6389" stroke-width="8" stroke-linecap="round"/>
       </g>`
    : id === 'nara'
    ? `<g transform="translate(216 207) rotate(-8)">
         <path d="M-5 5L92 -1" stroke="#5b4651" stroke-width="13" stroke-linecap="round"/>
         <path d="M47 -25Q77 -40 113 -25L127 16Q87 37 47 25Z"
           fill="#bdc9d0" stroke="#394052" stroke-width="5"/>
         <path d="M58 -19L116 -11" stroke="#f2f4f4" stroke-width="5" opacity=".8"/>
         <circle cx="13" cy="2" r="11" fill="#a2d56b" stroke="#344b54" stroke-width="4"/>
       </g>`
    : `<g transform="translate(214 211) rotate(-21)">
         <path d="M-2 2L92 -55L121 -2L11 20Z"
           fill="#ef9a59" stroke="#ffdd9e" stroke-width="5"/>
         <path d="M1 5L92 -55L104 -31L14 14Z" fill="#ffd59a"/>
         <path d="M8 6L98 -30" stroke="#fff5d4" stroke-width="3"/>
         <path d="M-7 7L29 -4" stroke="#58445c" stroke-width="10" stroke-linecap="round"/>
       </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 500"
      role="img" aria-label="Повноростова фігура персонажа ${id}">
    <defs>
      <linearGradient id="hair-${id}" x1="0" y1="0" x2=".8" y2="1">
        <stop stop-color="${palette.hairLight}"/>
        <stop offset="1" stop-color="${palette.hair}"/>
      </linearGradient>
      <linearGradient id="cape-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="${palette.cape}" stop-opacity=".96"/>
        <stop offset="1" stop-color="${palette.accent}" stop-opacity=".54"/>
      </linearGradient>
      <linearGradient id="body-${id}" x1=".1" y1="0" x2=".9" y2="1">
        <stop stop-color="${palette.main}"/>
        <stop offset="1" stop-color="${palette.panel}"/>
      </linearGradient>
    </defs>
    <g stroke-linejoin="round" stroke-linecap="round">
      <!-- Flowing cape and fabric, entirely behind the fighter. -->
      <path d="M124 181Q77 208 35 396Q81 377 105 398L138 306L171 298
        Q223 360 255 394Q211 277 184 182Z"
        fill="url(#cape-${id})" stroke="${palette.dark}" stroke-opacity=".45" stroke-width="4"/>
      <path d="M108 197Q94 282 67 365" stroke="${palette.trim}" stroke-width="5" opacity=".62"/>
      <!-- Two long legs and separate boots. -->
      <path d="M116 281L152 282L150 388L139 468Q124 480 101 470L107 390Z"
        fill="url(#body-${id})" stroke="${palette.dark}" stroke-width="6"/>
      <path d="M156 280L191 280L202 392L211 468Q193 482 172 469L161 393Z"
        fill="url(#body-${id})" stroke="${palette.dark}" stroke-width="6"/>
      <path d="M108 423L145 424L142 474Q130 489 96 477Z"
        fill="${palette.boot}" stroke="${palette.trim}" stroke-width="5"/>
      <path d="M169 425L203 425L218 472Q213 488 173 480Z"
        fill="${palette.boot}" stroke="${palette.trim}" stroke-width="5"/>
      <path d="M112 345L150 346M161 345L197 346" stroke="${palette.trim}" stroke-opacity=".65" stroke-width="4"/>
      <!-- Rear arm, armor shoulders, and hand. -->
      <path d="M120 181Q102 179 90 193L60 264Q59 282 72 286Q84 282 89 268
        L116 217Z" fill="${palette.skin}" stroke="${palette.shadow}" stroke-width="5"/>
      <path d="M119 182L99 182L82 231L103 241L130 197Z"
        fill="${palette.main}" stroke="${palette.trim}" stroke-width="5"/>
      <path d="M105 182Q117 164 133 164L176 164Q190 165 200 183
        L198 274Q188 300 151 299Q115 300 102 273Z"
        fill="url(#body-${id})" stroke="${palette.dark}" stroke-width="7"/>
      ${details}
      <!-- Neck, hair behind face and expressive head. -->
      <path d="M137 151L138 176Q153 190 168 176L170 147Z"
        fill="${palette.skin}" stroke="${palette.shadow}" stroke-width="5"/>
      ${hair}
      <path d="M110 89Q115 58 154 58Q196 62 196 99L190 138
        Q174 171 153 172Q130 170 114 142Z"
        fill="${palette.skin}" stroke="${palette.shadow}" stroke-width="5"/>
      <path d="M117 108Q132 101 146 108M161 108Q175 101 190 108"
        stroke="${palette.dark}" stroke-width="5"/>
      <ellipse cx="135" cy="120" rx="5" ry="6" fill="${palette.dark}"/>
      <ellipse cx="174" cy="120" rx="5" ry="6" fill="${palette.dark}"/>
      <path d="M147 132L153 135L159 132" stroke="${palette.shadow}" stroke-width="3" fill="none"/>
      <path d="M140 147Q153 154 168 147" stroke="${palette.shadow}" stroke-width="4" fill="none"/>
      ${id==='evi'? `<path d="M113 108Q133 101 150 110L150 131Q131 141 114 131Z
        M158 110Q175 102 192 110L192 131Q174 142 158 131Z"
          fill="#58738d" fill-opacity=".22" stroke="#354c61" stroke-width="5"/>
        <path d="M150 117L158 117" stroke="#354c61" stroke-width="5"/>` : ''}
      <!-- Forward arm and signature weapon. -->
      <path d="M192 182Q211 175 219 198L243 258Q242 278 229 282
        Q216 283 208 267L184 220Z"
        fill="${palette.skin}" stroke="${palette.shadow}" stroke-width="5"/>
      <path d="M184 179L203 181L227 229L209 242L180 200Z"
        fill="${palette.main}" stroke="${palette.trim}" stroke-width="5"/>
      <path d="M217 249Q229 242 239 253L244 265Q242 281 228 281
        Q218 279 216 267Z" fill="${palette.skin}" stroke="${palette.shadow}" stroke-width="4"/>
      ${weapon}
    </g>
  </svg>`;
}
