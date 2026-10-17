import {makePropSprite} from './prop-sprites.js?v=f4bcc730badf79307b1957673289498c327a4214';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=f4bcc730badf79307b1957673289498c327a4214';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
