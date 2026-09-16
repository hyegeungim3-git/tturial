// Body proportions for a neutral measurement mannequin, in metres.
// Four measurements cannot reconstruct an individual's exact body shape.
export function profileDimensions(profile) {
  for (const [key,min,max] of [['height',100,220],['chest',50,160],['arm',30,80],['shoulder',25,65]]) {
    if (!Number.isFinite(profile[key]) || profile[key] < min || profile[key] > max) return null;
  }
  const height=profile.height/100, depthRatio=.72;
  const ellipseFactor=Math.PI*(3*(1+depthRatio)-Math.sqrt((3+depthRatio)*(1+3*depthRatio)));
  return {height,shoulderWidth:profile.shoulder/100,armLength:profile.arm/100,
    chestRadius:profile.chest/100/ellipseFactor,chestDepthRatio:depthRatio,
    shoulderY:height*.82,hipY:height*.49,headHeight:height*.125};
}
