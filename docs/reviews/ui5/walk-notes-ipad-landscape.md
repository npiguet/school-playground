# UI5 walk notes (ipad-landscape)

Written by web/e2e/playability-ui5.spec.ts: one line per shot with the mixer's state (Ruling E10), any RED, the request origins.

- section camp
- e01-camp-tour-egg: wanted=camp playing=null ducks=[] unlocked=false voiceSpeaking=false
- e02-camp-tour-ring-parchemins: wanted=camp playing=camp ducks=[] unlocked=true voiceSpeaking=false
- e03-camp-tour-last: wanted=camp playing=camp ducks=[] unlocked=true voiceSpeaking=false
- e04-camp-greeting: wanted=camp playing=null ducks=[] unlocked=false voiceSpeaking=false
- section places
- e05-library-tour-lens: wanted=temple playing=temple ducks=[] unlocked=true voiceSpeaking=false
- e06-delphi-tour-tablets: wanted=temple playing=temple ducks=[] unlocked=true voiceSpeaking=false
- e21-war-tour-portraits: wanted=lair playing=lair ducks=[] unlocked=true voiceSpeaking=false
- e07-war-tour-eris: wanted=lair playing=lair ducks=[] unlocked=true voiceSpeaking=false
- e08-war-greeting: wanted=lair playing=null ducks=[] unlocked=false voiceSpeaking=false
- e09-nest-tour: wanted=camp playing=camp ducks=[] unlocked=true voiceSpeaking=false
- e10-cabin-tour-lyre: wanted=camp playing=camp ducks=[] unlocked=true voiceSpeaking=false
- section sound
- e11-hud-sound-plate: wanted=camp playing=null ducks=[] unlocked=true voiceSpeaking=false
- e22-lyre-egg: wanted=camp playing=null ducks=[] unlocked=true voiceSpeaking=false
- e12-lyre-sounds: wanted=camp playing=camp ducks=[] unlocked=true voiceSpeaking=false
- e13-lyre-tours: wanted=camp playing=camp ducks=[] unlocked=true voiceSpeaking=false
- section battle
- battle: /camp intercepted, no lieutenant awake, so the free text is Éris against the dragon
- e14-muster-eris-start: wanted=battle playing=battle ducks=[] unlocked=true voiceSpeaking=false
- e15-muster-voice-muted: wanted=battle playing=null ducks=[] unlocked=false voiceSpeaking=false
- e16-muster-retry: wanted=battle playing=battle ducks=[] unlocked=true voiceSpeaking=false
- e17-victory-eris: wanted=battle playing=battle ducks=[] unlocked=true voiceSpeaking=false
- e18-victory-explain: wanted=battle playing=battle ducks=[] unlocked=true voiceSpeaking=false
- e19-victory-explanation: wanted=battle playing=battle ducks=[] unlocked=true voiceSpeaking=false
- e20-band-sound-plate: wanted=battle playing=battle ducks=[] unlocked=true voiceSpeaking=false
- request origins: ["http://discorde:8080"]
