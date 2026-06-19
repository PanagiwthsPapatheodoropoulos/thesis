CREATE TABLE task_tags (
    task_id UUID NOT NULL,
    tag VARCHAR(255) NOT NULL,
    PRIMARY KEY (task_id, tag),
    CONSTRAINT fk_task_tags_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
