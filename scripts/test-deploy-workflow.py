#!/usr/bin/env python3
"""Exercise Deploy's image-name normalization without credentials or Docker."""

import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest


WORKFLOW = Path(__file__).resolve().parents[1] / '.github/workflows/deploy.yml'


class DeployImageNamesTest(unittest.TestCase):
    def test_mixed_case_repository_produces_lowercase_image_names(self):
        workflow = WORKFLOW.read_text()
        step = re.search(
            r'^      - name: Normalize image name\n'
            r'        run: \|\n((?:          .*\n)+)',
            workflow,
            re.MULTILINE,
        )
        if step is None:
            self.fail('Deploy must normalize the repository before tagging images')
        script = '\n'.join(line[10:] for line in step.group(1).splitlines())
        self.assertLess(step.start(), workflow.index('      - name: Extract metadata'))
        self.assertNotIn('IMAGE_NAME: ${{ github.repository }}', workflow)

        for repository in ('hollandkevint/CensusChat', 'Example-Owner/Mixed.Repo', 'owner/already-lowercase'):
            with self.subTest(repository=repository), tempfile.TemporaryDirectory() as directory:
                env_file = Path(directory) / 'github-env'
                subprocess.run(
                    ['bash', '-e', '-u', '-o', 'pipefail', '-c', script],
                    check=True,
                    env={**os.environ, 'GITHUB_REPOSITORY': repository, 'GITHUB_ENV': str(env_file)},
                )
                self.assertEqual(env_file.read_text(), f'IMAGE_NAME={repository.lower()}\n')

    def test_metadata_tags_and_outputs_share_the_normalized_name(self):
        workflow = WORKFLOW.read_text()
        # Metadata, two tags per image, and both deployment outputs must agree.
        self.assertEqual(workflow.count('${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}'), 7)
        for component in ('backend', 'frontend'):
            for tag in ('latest', '${{ github.sha }}'):
                self.assertIn(f'${{{{ env.IMAGE_NAME }}}}/{component}:{tag}', workflow)
            self.assertIn(
                f'echo "{component}-image=${{{{ env.REGISTRY }}}}/${{{{ env.IMAGE_NAME }}}}/{component}:${{{{ github.sha }}}}"',
                workflow,
            )
        self.assertNotIn('${{ github.repository }}', workflow)

    def test_manual_only_and_requires_site_url(self):
        workflow = WORKFLOW.read_text()
        on_block = workflow.split('\njobs:')[0]
        self.assertIn('workflow_dispatch:', on_block)
        self.assertNotRegex(on_block, r'(?m)^  (push|pull_request|schedule):')
        self.assertIn('NEXT_PUBLIC_SITE_URL=${{ vars.NEXT_PUBLIC_SITE_URL }}', workflow)
        self.assertIn('Set the NEXT_PUBLIC_SITE_URL repo variable', workflow)
        self.assertLess(workflow.index('Require NEXT_PUBLIC_SITE_URL'), workflow.index('Build and push Backend'))


if __name__ == '__main__':
    unittest.main()
