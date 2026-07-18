import type { BundlingOptions } from "aws-cdk-lib/aws-lambda-nodejs";

/**
 * @prisma/client ships a native query-engine binary that esbuild can't
 * bundle, so it's marked external — but that alone only stops esbuild from
 * inlining it, it does nothing to get the package into the deployed zip.
 * This copies the already-generated client (see prisma/schema.prisma's
 * binaryTargets — it includes rhel-openssl-3.0.x specifically so the engine
 * actually runs on Lambda's Amazon Linux runtime, not just this machine)
 * straight from the local node_modules into the bundle output.
 *
 * Requires `npx prisma generate` to have already been run in backendRoot —
 * see infra/README.md's "Before deploying".
 */
export function prismaLambdaBundling(): BundlingOptions {
  return {
    externalModules: ["@prisma/client", ".prisma/client"],
    commandHooks: {
      beforeBundling: () => [],
      beforeInstall: () => [],
      afterBundling: (inputDir: string, outputDir: string) => [
        `mkdir -p ${outputDir}/node_modules/@prisma`,
        `cp -r ${inputDir}/node_modules/@prisma/client ${outputDir}/node_modules/@prisma/client`,
        `cp -r ${inputDir}/node_modules/.prisma ${outputDir}/node_modules/.prisma`,
      ],
    },
  };
}
