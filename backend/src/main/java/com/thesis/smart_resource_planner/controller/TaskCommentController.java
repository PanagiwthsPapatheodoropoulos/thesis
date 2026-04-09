// src/main/java/com/thesis/smart_resource_planner/controller/TaskCommentController.java
package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.TaskCommentCreateDTO;
import com.thesis.smart_resource_planner.model.dto.TaskCommentDTO;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskCommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for task comment operations.
 * Allows team members to add threaded discussion comments to tasks,
 * retrieve the full comment history, and delete their own comments.
 */
@RestController
@RequestMapping("/api/tasks/comments")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class TaskCommentController {

    private final TaskCommentService commentService;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    /**
     * Adds a new comment to a task.
     * Validates that the task and user both exist and that the comment text is
     * non-empty.
     *
     * @param createDTO   The comment payload containing the task ID and comment
     *                    text.
     * @param currentUser The authenticated user submitting the comment.
     * @return The saved comment, or an appropriate error status.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TaskCommentDTO> createComment(
            @Valid @RequestBody TaskCommentCreateDTO createDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        try {
            // Validate task exists
            if (!taskRepository.existsById(createDTO.getTaskId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

            // Validate user exists
            if (!userRepository.existsById(currentUser.getId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

            // Validate comment not empty
            if (createDTO.getComment() == null || createDTO.getComment().trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            TaskCommentDTO comment = commentService.createComment(createDTO, currentUser.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(comment);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Returns all comments for a specific task in chronological order.
     *
     * @param taskId The UUID of the task.
     * @return A list of comments, or 404 if the task does not exist.
     */
    @GetMapping("/task/{taskId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskCommentDTO>> getCommentsByTask(@PathVariable UUID taskId) {
        try {
            // Check if task exists
            if (!taskRepository.existsById(taskId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

            List<TaskCommentDTO> comments = commentService.getCommentsByTask(taskId);
            return ResponseEntity.ok(comments);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Returns the total count of comments for a given task.
     * Useful for displaying an unread comment badge without fetching full text.
     *
     * @param taskId The UUID of the task.
     * @return The total number of comments on the task.
     */
    @GetMapping("/task/{taskId}/count")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Long> getCommentCount(@PathVariable UUID taskId) {
        try {
            if (!taskRepository.existsById(taskId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            Long count = commentService.getCommentCount(taskId);
            return ResponseEntity.ok(count);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Deletes a comment by its ID.
     * Only the comment author or an admin may remove the comment.
     *
     * @param id          The UUID of the comment to delete.
     * @param currentUser The authenticated user requesting the deletion.
     * @return 204 No Content on success.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Void> deleteComment(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        try {
            commentService.deleteComment(id, currentUser.getId());
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}