import {makePropSprite} from './prop-sprites.js?v=ef25eb6cbf04bd83f92d4ff2ec9e98923082dbeb';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=ef25eb6cbf04bd83f92d4ff2ec9e98923082dbeb';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
