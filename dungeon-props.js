import {makePropSprite} from './prop-sprites.js?v=6f522cb686c558f4c908d1aec66f280bb4b8a20c';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=6f522cb686c558f4c908d1aec66f280bb4b8a20c';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
