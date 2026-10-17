import {makePropSprite} from './prop-sprites.js?v=05c9c484d8c647e1ae1ba04d4edb6e7962a3c4cb';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=05c9c484d8c647e1ae1ba04d4edb6e7962a3c4cb';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
