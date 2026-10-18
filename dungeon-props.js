import {makePropSprite} from './prop-sprites.js?v=3a935cc6f4441f417ac4e7ea28a8fd66890685b1';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=3a935cc6f4441f417ac4e7ea28a8fd66890685b1';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
