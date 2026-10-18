import {makePropSprite} from './prop-sprites.js?v=7ab9ee66430396ccf651b982597738c01913a015';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=7ab9ee66430396ccf651b982597738c01913a015';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
