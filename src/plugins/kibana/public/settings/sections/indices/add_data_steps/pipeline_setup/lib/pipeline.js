import _ from 'lodash';

export default class Pipeline {

  constructor(processorTypes, Processor) {
    this.processors = [];
    this.counter = 0;
    this.input = {};
    this.output = undefined;
    this.dirty = false;
    this.Processor = Processor;
    this.processorTypes = processorTypes;
  }

  load(pipeline) {
    while (this.processors.length > 0) {
      this.processors.pop();
    }

    pipeline.processors.forEach((processor) => {
      this.addExisting(processor);
    });
  }

  remove(processor) {
    const processors = this.processors;
    const index = processors.indexOf(processor);

    processors.splice(index, 1);
  }

  moveUp(processor) {
    const processors = this.processors;
    const index = processors.indexOf(processor);

    if (index === 0) return;

    const temp = processors[index - 1];
    processors[index - 1] = processors[index];
    processors[index] = temp;
  }

  moveDown(processor) {
    const processors = this.processors;
    const index = processors.indexOf(processor);

    if (index === processors.length - 1) return;

    const temp = processors[index + 1];
    processors[index + 1] = processors[index];
    processors[index] = temp;
  }

  addExisting(existingProcessor) {
    const processors = this.processors;
    const processorType = _.find(this.processorTypes, (o) => { return o.typeId === existingProcessor.typeId; });
    const newProcessor = this.add(processorType);

    const keys = _(existingProcessor)
                  .keys()
                  .omit(['title', 'template', 'typeId', 'processorId', 'outputObject', 'inputObject', 'description'])
                  .value();
    keys.forEach((key) => {
      _.set(newProcessor, key, _.get(existingProcessor, key));
    });

    return newProcessor;
  }

  add(processorType) {
    const processors = this.processors;
    const newProcessor = new this.Processor(processorType);

    this.counter += 1;
    newProcessor.processorId = `processor_${this.counter}`;
    processors.push(newProcessor);

    return newProcessor;
  }

  updateParents() {
    const processors = this.processors;

    processors.forEach((processor, index) => {
      let newParent;
      if (index === 0) {
        newParent = this.input;
      } else {
        newParent = processors[index - 1];
      }

      processor.setParent(newParent);
    });
  }

  updateOutput() {
    const processors = this.processors;

    this.output = undefined;
    if (processors.length > 0) {
      this.output = processors[processors.length - 1].outputObject;
    }
  }

  getProcessorById(processorId) {
    const result = _.find(this.processors, (processor) => { return processor.processorId === processorId; });
    return result;
  }

  // Updates the state of the pipeline and processors with the results
  // from an ingest simulate call.
  applySimulateResults(results) {
    //update the outputObject of each processor
    results.forEach((result) => {
      const processor = this.getProcessorById(result.processorId);

      processor.outputObject = _.get(result, 'output');
      processor.error = _.get(result, 'error');
    });

    //update the inputObject of each processor
    results.forEach((result) => {
      const processor = this.getProcessorById(result.processorId);

      //we don't want to change the inputObject if the parent processor
      //is in error because that can cause us to lose state.
      if (!_.get(processor, 'error.isNested')) {
        if (processor.parent.processorId) {
          processor.inputObject = _.cloneDeep(processor.parent.outputObject);
        } else {
          processor.inputObject = _.cloneDeep(processor.parent);
        }
      }

      processor.updateDescription();
    });

    this.updateOutput();
    this.dirty = false;
  }

}
