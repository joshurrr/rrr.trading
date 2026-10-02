// Public diagnostics were relocated to the private NAS admin console.
require('./public-presentation.test.cjs')(['short', 'medium', 'long']).catch(error=>{console.error(error);process.exitCode=1;});
