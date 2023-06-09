# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
# Lint at: python3
"""Example demo loading Stanza models.

To run the demo:
    pip install stanza
    python -m lit_nlp.examples.stanza_demo --port=5432
Then navigate to localhost:5432 to access the demo UI.
"""
import sys
from typing import Optional, Sequence

from absl import app
from absl import flags
from absl import logging

from lit_nlp import dev_server
from lit_nlp import server_flags
import lit_nlp.api.dataset as lit_dataset
import lit_nlp.api.types as lit_types
from lit_nlp.components import scrambler
from lit_nlp.components import word_replacer
from lit_nlp.examples.datasets import glue
from lit_nlp.examples.models import stanza_models
import stanza

FLAGS = flags.FLAGS

FLAGS.set_default("development_demo", True)

_SEQUENCE_TASKS = flags.DEFINE_list(
    "sequence_tasks",
    ["upos", "xpos", "lemma"],
    "Sequence tasks to load and use for prediction. Defaults to all sequence tasks",
)

_SPAN_TASKS = flags.DEFINE_list(
    "span_tasks",
    ["mention"],
    "Span tasks to load and use for prediction. Only mentions are included in this demo",
)

_EDGE_TASKS = flags.DEFINE_list(
    "edge_tasks",
    ["deps"],
    "Span tasks to load and use for prediction. Only deps are included in this demo",
)

_LANGUAGE = flags.DEFINE_string("language", "en",
                                "Language to load for Stanza model.")

_MAX_EXAMPLES = flags.DEFINE_integer(
    "max_examples", None, "Maximum number of examples to load into LIT.")


def get_wsgi_app() -> Optional[dev_server.LitServerType]:
  """Returns a LitApp instance for consumption by gunicorn."""
  FLAGS.set_default("server_type", "external")
  FLAGS.set_default("demo_mode", True)
  # Parse flags without calling app.run(main), to avoid conflict with
  # gunicorn command line flags.
  unused = flags.FLAGS(sys.argv, known_only=True)
  if unused:
    logging.info("stanza_demo:get_wsgi_app() called with unused args: %s",
                 unused)
  return main([])


def main(argv: Sequence[str]) -> Optional[dev_server.LitServerType]:
  if len(argv) > 1:
    raise app.UsageError("Too many command-line arguments.")

  # Set Tasks as a dictionary with task groups as
  # keys and values as lists of strings of Stanza task names
  tasks = {
      "sequence": _SEQUENCE_TASKS.value,
      "span": _SPAN_TASKS.value,
      "edge": _EDGE_TASKS.value,
  }

  # Get the correct model for the language
  stanza.download(_LANGUAGE.value)
  pretrained_model = stanza.Pipeline(_LANGUAGE.value)
  models = {
      "stanza": stanza_models.StanzaTagger(pretrained_model, tasks),
  }

  # Datasets for LIT demo
  # TODO(nbroestl): Use the UD dataset
  # (https://huggingface.co/datasets/universal_dependencies)
  datasets = {
      "SST2": glue.SST2Data(split="validation").slice[:_MAX_EXAMPLES.value],
      "blank": lit_dataset.Dataset({"text": lit_types.TextSegment()}, []),
  }

  # Add generators
  generators = {
      "scrambler": scrambler.Scrambler(),
      "word_replacer": word_replacer.WordReplacer(),
  }

  # Start the LIT server. See server_flags.py for server options.
  lit_demo = dev_server.Server(
      models, datasets, generators, **server_flags.get_flags()
  )
  return lit_demo.serve()


if __name__ == "__main__":
  app.run(main)
