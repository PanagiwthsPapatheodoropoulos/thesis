package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.TaskCommentCreateDTO;
import com.thesis.smart_resource_planner.model.dto.TaskCommentDTO;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskComment;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.TaskCommentRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service for task comment management.
 *
 * <p>
 * Provides creation, retrieval, count, and deletion of comments
 * attached to tasks. Only the comment author or an admin may delete
 * a comment.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TaskCommentService {

    private final TaskCommentRepository commentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ModelMapper modelMapper;

    /**
     * Creates a new comment on a task.
     *
     * @param createDTO DTO containing the task ID and comment text
     * @param userId    UUID of the user posting the comment
     * @return the saved {@link TaskCommentDTO}
     * @throws RuntimeException if an unexpected error occurs during persistence
     */
    public TaskCommentDTO createComment(TaskCommentCreateDTO createDTO, UUID userId) {
        try {
            Task task = taskRepository.findById(createDTO.getTaskId())
                    .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            TaskComment comment = TaskComment.builder()
                    .task(task)
                    .user(user)
                    .comment(createDTO.getComment().trim())
                    .build();

            TaskComment saved = commentRepository.saveAndFlush(comment);
            return mapToDTO(saved);

        } catch (Exception e) {
            throw new RuntimeException("Failed to create comment: " + e.getMessage());
        }
    }

    /**
     * Returns all comments for a task, ordered from newest to oldest.
     *
     * @param taskId UUID of the task
     * @return list of {@link TaskCommentDTO} objects
     */
    @Transactional(readOnly = true)
    public List<TaskCommentDTO> getCommentsByTask(UUID taskId) {
        return commentRepository.findByTaskIdOrderByCreatedAtDesc(taskId).stream()
                .map(this::mapToDTO)
                .toList();
    }

    /**
     * Returns the total number of comments for a given task.
     *
     * @param taskId UUID of the task
     * @return comment count
     */
    @Transactional(readOnly = true)
    public Long getCommentCount(UUID taskId) {
        return commentRepository.countByTaskId(taskId);
    }

    /**
     * Deletes a comment, enforcing ownership (only the author or an ADMIN may
     * delete).
     *
     * @param commentId UUID of the comment to delete
     * @param userId    UUID of the requesting user
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               the
     *                                                                               comment
     *                                                                               or
     *                                                                               user
     *                                                                               is
     *                                                                               not
     *                                                                               found
     * @throws IllegalStateException                                                 if
     *                                                                               the
     *                                                                               user
     *                                                                               is
     *                                                                               neither
     *                                                                               the
     *                                                                               comment
     *                                                                               author
     *                                                                               nor
     *                                                                               an
     *                                                                               admin
     */
    public void deleteComment(UUID commentId, UUID userId) {
        TaskComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        // Only allow deletion by comment owner or admin
        if (!comment.getUser().getId().equals(userId)) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            if (!user.getRole().name().equals("ADMIN")) {
                throw new IllegalStateException("Only comment owner or admin can delete");
            }
        }

        commentRepository.delete(comment);
    }

    /**
     * Maps a {@link TaskComment} entity to a {@link TaskCommentDTO}.
     *
     * @param comment the comment entity
     * @return the populated DTO
     */
    private TaskCommentDTO mapToDTO(TaskComment comment) {
        TaskCommentDTO dto = modelMapper.map(comment, TaskCommentDTO.class);
        dto.setUserId(comment.getUser().getId());
        dto.setUserName(comment.getUser().getUsername());
        dto.setTaskId(comment.getTask().getId());
        return dto;
    }
}