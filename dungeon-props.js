import {makePropSprite} from './prop-sprites.js?v=d254ffd0166a8bf116fdee214c40cf5e7905e9ad';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=d254ffd0166a8bf116fdee214c40cf5e7905e9ad';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
